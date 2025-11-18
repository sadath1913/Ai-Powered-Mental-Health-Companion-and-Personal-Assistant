// backend/controllers/user.controllers.js
import uploadOnCloudinary from "../config/cloudinary.js";
import geminiResponse from "../gemini.js";
import User from "../models/user.model.js";
import Reminder from "../models/reminder.model.js";
import * as chrono from "chrono-node"; // <-- fixed import for ESM
import moment from "moment";
import { scheduleSms } from "../utils/twilio.js";

// Simple in-memory dedupe for requestIds
const processedRequestIds = new Set();

export const getCurrentUser = async (req, res) => {
  try {
    const userId = req.userId;
    const user = await User.findById(userId).select("-password");
    if (!user) {
      return res.status(400).json({ message: "user not found" });
    }
    return res.status(200).json(user);
  } catch (error) {
    console.error("getCurrentUser error:", error);
    return res.status(400).json({ message: "get current user error" });
  }
};

export const updateAssistant = async (req, res) => {
  try {
    const { assistantName, imageUrl } = req.body;
    let assistantImage;
    if (req.file) {
      assistantImage = await uploadOnCloudinary(req.file.path);
    } else {
      assistantImage = imageUrl;
    }

    const user = await User.findByIdAndUpdate(
      req.userId,
      { assistantName, assistantImage },
      { new: true }
    ).select("-password");
    return res.status(200).json(user);
  } catch (error) {
    console.error("updateAssistant error:", error);
    return res.status(400).json({ message: "updateAssistantError user error" });
  }
};

export const askToAssistant = async (req, res) => {
  try {
    const { command, requestId } = req.body || {};
    console.log("askToAssistant: incoming", { command, requestId, userId: req.userId });

    if (!command || typeof command !== "string") {
      return res.status(400).json({ response: "No command provided" });
    }

    // dedupe by requestId (frontend should send one)
    if (requestId) {
      if (processedRequestIds.has(requestId)) {
        console.log("askToAssistant: duplicate requestId received, ignoring:", requestId);
        return res.json({ type: "general", userInput: command, response: "Duplicate request ignored." });
      }
      processedRequestIds.add(requestId);
      // auto-remove after 5 minutes to keep memory bounded
      setTimeout(() => processedRequestIds.delete(requestId), 1000 * 60 * 5);
    }

    const user = await User.findById(req.userId);
    if (!user) {
      console.log("askToAssistant: user not found for userId:", req.userId);
      return res.status(404).json({ response: "User not found" });
    }

    // persist history
    user.history = user.history || [];
    user.history.push(command);
    await user.save();

    const lowerCmd = command.toLowerCase();

    // ----------------------------
    // 1) Create reminder detection
    // ----------------------------
    if (
      lowerCmd.includes("remind me") ||
      lowerCmd.includes("set a reminder") ||
      lowerCmd.includes("reminder to") ||
      /\bremind\b/.test(lowerCmd)
    ) {
      console.log("askToAssistant: reminder detected for user:", user._id.toString(), "text:", command);

      // parse date/time using chrono
      let dueAt = null;
      try {
        const parsed = chrono.parse(command, new Date(), { forwardDate: true });
        if (parsed && parsed.length > 0) dueAt = parsed[0].start.date();
        console.log("askToAssistant: chrono parsed dueAt:", dueAt);
      } catch (parseErr) {
        console.error("askToAssistant: chrono parse error:", parseErr);
      }

      if (!dueAt) {
        // ask clarification if no datetime
        return res.json({
          type: "general",
          userInput: command,
          response:
            "I understood you want a reminder. When should I remind you? (e.g., today at 2pm or tomorrow 09:00)",
        });
      }
      try {
        // Resolve phone priority: explicit passed to endpoint -> user.phone -> DEFAULT_REMINDER_PHONE
        const defaultNumber = process.env.DEFAULT_REMINDER_PHONE || null;
        const resolvedNumber = (req.body && req.body.toNumber) || user.phone || defaultNumber;

        // create DB record first
        const reminder = await Reminder.create({
          user: user._id,
          title: command,
          dueAt,
          toNumber: resolvedNumber,
        });

        console.log("askToAssistant: reminder created id=", reminder._id.toString(), "toNumber:", resolvedNumber);

        // Try to schedule with Twilio (uses Messaging Service SID, validated earlier)
        try {
          const scheduled = await scheduleSms(resolvedNumber, `Reminder: ${command}`, dueAt);
          console.log("askToAssistant: scheduleSms result:", scheduled);

          if (scheduled && scheduled.sid) {
            // persist Twilio scheduled SID + scheduledAt for tracking
            reminder.twilioScheduledSid = scheduled.sid;
            reminder.scheduledAt = scheduled.sendAt ? new Date(scheduled.sendAt) : dueAt;
            await reminder.save();

            console.log("askToAssistant: scheduled in Twilio sid=", scheduled.sid);

            return res.status(201).json({
              type: "general",
              userInput: command,
              response: `Okay — I will remind you at ${reminder.scheduledAt.toLocaleString()}. (Scheduled)`,
              reminder,
            });
          } else {
            console.log("askToAssistant: Twilio scheduling returned no sid, will use server scheduler fallback");
          }
        } catch (twErr) {
          console.error("askToAssistant: Twilio scheduling error:", twErr);
          // proceed to fallback response — reminder is already saved in DB
        }

        // fallback response (Twilio not used / failed) — server scheduler will send
        return res.status(201).json({
          type: "general",
          userInput: command,
          response: `Okay — I will remind you: "${command}" at ${dueAt.toLocaleString()}.`,
          reminder,
        });
      } catch (dbErr) {
        console.error("askToAssistant: failed to create reminder:", dbErr);
        return res.status(500).json({ response: "Failed to create reminder", error: dbErr.message });
      }
    }

    // ----------------------------
    // 2) List reminders detection
    if (
      lowerCmd.includes("what did i ask") ||
      lowerCmd.includes("my reminders") ||
      lowerCmd.includes("list reminders") ||
      lowerCmd.includes("what did you remind me") ||
      lowerCmd.includes("what i asked you to remind")
    ) {
      const reminders = await Reminder.find({ user: user._id }).sort({ dueAt: 1 });

      console.log("askToAssistant: listing reminders count=", reminders.length);
      if (!reminders || reminders.length === 0) {
        return res.json({ type: "general", userInput: command, response: "You currently have no reminders.", reminders: [] });
      }

      // Build a friendly numbered list (no raw Mongo _id printed)
      const lines = reminders.map((r, idx) => {
        // format dueAt nicely (use server locale or moment)
        const when = r.dueAt ? moment(r.dueAt).format("DD/MM/YYYY, h:mm:ss A") : "no time set";
        // include a short preview id optionally (first 6 chars) — remove entirely if you don't want any id
        // const shortId = r._id.toString().slice(0, 6);
        return `${idx + 1}. ${r.title} at ${when}${r.sentAt ? " (sent)" : ""}`;
      });

      return res.json({
        type: "general",
        userInput: command,
        response: `Your reminders:\n${lines.join("\n")}`,
        reminders, // full objects for UI (if needed)
      });
    }

    // ----------------------------
    // 3) Delete reminder detection
    // ----------------------------
    if (lowerCmd.includes("delete reminder") || lowerCmd.includes("remove reminder") || lowerCmd.includes("delete my reminder")) {
      const reminders = await Reminder.find({ user: user._id }).sort({ dueAt: 1 });
      if (!reminders || reminders.length === 0) {
        return res.json({ type: "general", userInput: command, response: "You have no reminders to delete." });
      }

      const foundById = reminders.find((r) => command.includes(r._id.toString()));
      let deleted = null;

      if (foundById) {
        deleted = await Reminder.findByIdAndDelete(foundById._id);
      } else {
        const foundByTitle = reminders.find((r) => command.toLowerCase().includes(r.title.toLowerCase().slice(0, 30)));
        if (foundByTitle) deleted = await Reminder.findByIdAndDelete(foundByTitle._id);
        else deleted = await Reminder.findByIdAndDelete(reminders[0]._id);
      }

      if (!deleted) {
        return res.json({
          type: "general",
          userInput: command,
          response: "Couldn't find the reminder to delete. Try saying the exact reminder text or id.",
        });
      }

      console.log("askToAssistant: deleted reminder id=", deleted._id.toString());
      return res.json({
        type: "general",
        userInput: command,
        response: `Deleted reminder: ${deleted.title} scheduled at ${deleted.dueAt.toLocaleString()}`,
      });
    }

    // ----------------------------
    // Not a reminder command → fallback to Gemini
    // ----------------------------
    console.log("askToAssistant: calling Gemini for command:", command);
    const userName = user.name;
    const assistantName = user.assistantName || "Assistant";
    const result = await geminiResponse(command, assistantName, userName);

    let gemResult;
    if (typeof result === "object") {
      gemResult = result;
    } else if (typeof result === "string") {
      try {
        gemResult = JSON.parse(result);
      } catch {
        const jsonMatch = result.match(/{[\s\S]*}/);
        if (!jsonMatch) {
          return res.status(400).json({ response: "Sorry, I can't understand that." });
        }
        gemResult = JSON.parse(jsonMatch[0]);
      }
    } else {
      gemResult = { type: "general", userInput: command, response: "I couldn't parse assistant response." };
    }

    console.log("🧩 Parsed gemResult:", gemResult);

    const type = gemResult.type;

    switch (type) {
      case "get-date":
        return res.json({
          type,
          userInput: gemResult.userInput,
          response: `Current date is ${moment().format("YYYY-MM-DD")}`,
        });

      case "get-time":
        return res.json({
          type,
          userInput: gemResult.userInput,
          response: `Current time is ${moment().format("hh:mm A")}`,
        });

      case "get-day":
        return res.json({
          type,
          userInput: gemResult.userInput,
          response: `Today is ${moment().format("dddd")}`,
        });

      case "get-month":
        return res.json({
          type,
          userInput: gemResult.userInput,
          response: `This month is ${moment().format("MMMM")}`,
        });

      case "google-search":
      case "youtube-search":
      case "youtube-play":
      case "general":
      case "calculator-open":
      case "instagram-open":
      case "facebook-open":
      case "weather-show":
      case "mental-health":
        return res.json({
          type,
          userInput: gemResult.userInput,
          response: gemResult.response,
        });

      default:
        return res.status(400).json({ response: "I didn't understand that command." });
    }
  } catch (error) {
    console.error("❌ askToAssistant error:", error);
    return res.status(500).json({ response: "ask assistant error" });
  }
};
