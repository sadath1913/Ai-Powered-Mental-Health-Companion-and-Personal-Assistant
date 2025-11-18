// backend/controllers/reminder.controllers.js
import Reminder from "../models/reminder.model.js";
import User from "../models/user.model.js";
import * as chrono from "chrono-node";
import { sendSmsImmediate, scheduleSms, cancelScheduledSms } from "../utils/twilio.js";

/**
 * Create a reminder.
 * Body: { text, dueAt (optional ISO), toNumber (optional), tag (optional) }
 */
export const createReminder = async (req, res) => {
  try {
    const userId = req.userId;
    const { text, dueAt: dueAtIso, toNumber, tag } = req.body;
    if (!text) return res.status(400).json({ message: "Text required" });

    // parse dueAt from ISO or from natural language text
    let dueAt = null;
    if (dueAtIso) {
      const d = new Date(dueAtIso);
      if (!isNaN(d)) dueAt = d;
    }
    if (!dueAt) {
      const parsed = chrono.parse(text, new Date(), { forwardDate: true });
      if (parsed && parsed.length > 0) dueAt = parsed[0].start.date();
    }
    if (!dueAt) return res.status(400).json({ message: "Could not parse date/time from text" });

    // Resolve phone number priority: explicit toNumber -> user.phone -> DEFAULT_REMINDER_PHONE
    const defaultNumber = process.env.DEFAULT_REMINDER_PHONE || null;
    const user = await User.findById(userId);
    const resolvedNumber = toNumber || user?.phone || defaultNumber;

    // Save reminder with the resolved toNumber
    const reminder = await Reminder.create({
      user: userId,
      title: text,
      tag: tag || null,
      dueAt,
      toNumber: resolvedNumber,
    });

    console.log("createReminder: saved reminder id=", reminder._id.toString(), "toNumber:", resolvedNumber);

    // Try to schedule with Twilio if we have a number
    if (resolvedNumber) {
      try {
        console.log("createReminder: attempting Twilio schedule for:", resolvedNumber, "at", dueAt.toISOString());
        const scheduled = await scheduleSms(resolvedNumber, `Reminder: ${command}`, dueAt);
        console.log("DEBUG scheduleSms result:", scheduled);
        if (scheduled && scheduled.sid) {
          reminder.twilioScheduledSid = scheduled.sid;
          await reminder.save();
          console.log("createReminder: scheduled in Twilio sid=", scheduled.sid);
          return res.status(201).json({ message: "Reminder created and scheduled in Twilio", reminder });
        } else {
          console.log("createReminder: Twilio scheduling returned no SID, falling back to server scheduler");
        }
      } catch (err) {
        console.error("createReminder: Twilio scheduling error:", err);
      }
    } else {
      console.log("createReminder: no phone available, will use server scheduler fallback");
    }

    // fallback: just save DB record and rely on server scheduler
    return res.status(201).json({ message: "Reminder created (will be sent by server scheduler)", reminder });
  } catch (error) {
    console.error("createReminder error:", error);
    return res.status(500).json({ message: "create reminder error" });
  }
};

export const listReminders = async (req, res) => {
  try {
    const userId = req.userId;
    const reminders = await Reminder.find({ user: userId }).sort({ dueAt: 1 });
    return res.status(200).json(reminders);
  } catch (error) {
    console.error("listReminders error:", error);
    return res.status(500).json({ message: "list reminders error" });
  }
};

export const deleteReminder = async (req, res) => {
  try {
    const userId = req.userId;
    const id = req.params.id;
    const reminder = await Reminder.findOne({ _id: id, user: userId });
    if (!reminder) return res.status(404).json({ message: "Reminder not found" });

    // If scheduled in Twilio, attempt cancel
    if (reminder.twilioScheduledSid) {
      try {
        await cancelScheduledSms(reminder.twilioScheduledSid);
        console.log("deleteReminder: cancelled twilio scheduled sid:", reminder.twilioScheduledSid);
      } catch (err) {
        console.warn("deleteReminder: failed to cancel twilio scheduled sid:", reminder.twilioScheduledSid, err);
      }
    }

    await reminder.remove();
    return res.status(200).json({ message: "Reminder deleted", reminder });
  } catch (error) {
    console.error("deleteReminder error:", error);
    return res.status(500).json({ message: "delete reminder error" });
  }
};

/**
 * Find due reminders that are not yet sent and attempt to send them.
 * This is called by scheduler every minute as a fallback (if Twilio scheduling not used).
 */
export const sendDueReminders = async ({ twilioToOverride } = {}) => {
  try {
    const now = new Date();
    const due = await Reminder.find({ dueAt: { $lte: now }, sentAt: null });
    for (const r of due) {
      try {
        // If Twilio scheduled SID exists, it likely already handled sending — mark as sent to avoid duplicates
        // Twilio scheduled this message — skip it here and rely on TWILIO WEBHOOK to mark sentAt.
        if (r.twilioScheduledSid) {
          console.log("Skipping Twilio-scheduled reminder (will wait for webhook):", r._id.toString());
          continue;
        }

        const user = await User.findById(r.user);
        const defaultNumber = process.env.DEFAULT_REMINDER_PHONE || null;
        const toNumber = twilioToOverride || r.toNumber || user?.phone || defaultNumber;
        const body = `Reminder: ${r.title} at ${r.dueAt.toLocaleString()}`;

        console.log("sendDueReminders: attempting to send reminder", r._id.toString(), "to:", toNumber);

        if (toNumber) {
          const msg = await sendSmsImmediate(toNumber, body);
          if (msg && msg.sid) {
            r.sentAt = new Date();
            r.autoSent = true;
            await r.save();
            console.log("Reminder sent via Twilio immediate:", r._id.toString(), "sid:", msg.sid);
            continue;
          } else {
            console.warn("Failed to send via Twilio for reminder:", r._id.toString(), msg);
          }
        } else {
          console.warn("No toNumber available for reminder:", r._id.toString());
        }

        // If we couldn't send, still mark sentAt to avoid repeated attempts — you may change this behavior
        r.sentAt = new Date();
        r.autoSent = false;
        await r.save();
      } catch (err) {
        console.error("Error sending reminder id:", r._id, err);
      }
    }
    return due.length;
  } catch (error) {
    console.error("sendDueReminders error:", error);
    return 0;
  }
};
