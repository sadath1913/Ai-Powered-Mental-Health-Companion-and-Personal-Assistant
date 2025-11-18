// backend/controllers/health.controller.js
import HealthReading from "../models/healthReading.model.js";
import User from "../models/user.model.js";
import geminiResponse from "../gemini.js";
import { sendSmsImmediate } from "../utils/twilio.js"; // optional - your project may or may not have this

// Simple static evaluation (you can extend)
function staticEvaluate(hr, temp) {
  if (!hr || hr <= 0) return { severity: "info", tag: "no_hr", title: "No HR", message: "No stable heart rate detected." };
  if (hr < 40) return { severity: "critical", tag: "crit_low_hr", title: "Very low heart rate", message: `Heart rate ${hr} BPM is very low.` };
  if (hr < 55) return { severity: "warning", tag: "low_hr", title: "Low heart rate", message: `Heart rate ${hr} BPM is low.` };
  if (hr > 130) return { severity: "critical", tag: "crit_high_hr", title: "Very high heart rate", message: `Heart rate ${hr} BPM is very high.` };
  if (hr > 100) return { severity: "warning", tag: "high_hr", title: "High heart rate", message: `Heart rate ${hr} BPM is elevated.` };
  if (temp >= 38.5) return { severity: "critical", tag: "fever", title: "High temperature", message: `Temperature ${temp.toFixed(1)}°C indicates fever.` };
  if (temp >= 37.5) return { severity: "warning", tag: "low_fever", title: "Mild fever", message: `Temperature ${temp.toFixed(1)}°C is slightly raised.` };
  return { severity: "info", tag: "normal", title: "Normal", message: `Heart ${hr} BPM, Temp ${temp.toFixed(1)}°C` };
}

async function getAiSuggestion(user, hr, temp, fallback) {
  try {
    const prompt = `You are a friendly health assistant. User ${user.name || "User"} has heart rate ${hr} BPM and temperature ${temp}°C.
Give a short (1-2 lines) helpful suggestion.`;
    const ai = await geminiResponse(prompt, user.assistantName || "Assistant", user.name || "User");
    if (!ai) return { text: fallback, usedAI: false };
    const text = (typeof ai === "string" ? ai : ai.response || ai.text) || fallback;
    return { text: text.toString().trim(), usedAI: true };
  } catch (e) {
    return { text: fallback, usedAI: false };
  }
}

/**
 * Named export required by routes import:
 * export { updateHealthData } OR export const updateHealthData = ...
 */
export const updateHealthData = async (req, res) => {
  try {
    const { userId, heartRate, temperature, source, timestamp } = req.body || {};
    if (!userId) return res.status(400).json({ error: "userId required" });
    if (typeof heartRate !== "number" || typeof temperature !== "number") {
      return res.status(400).json({ error: "heartRate and temperature must be numbers" });
    }

    // 1) Save reading
    const reading = await HealthReading.create({
      user: userId,
      heartRate,
      temperature,
      source: source || "esp8266",
      createdAt: timestamp ? new Date(timestamp) : new Date(),
    });

    // 2) Update user snapshot
    const user = await User.findById(userId);
    if (!user) {
      // reading stored but user not found — return reading id
      return res.status(201).json({ success: true, readingId: reading._id, warning: "user not found" });
    }

    user.health = user.health || {};
    user.health.latestHeartRate = heartRate;
    user.health.latestTemperature = temperature;
    user.health.updatedAt = new Date();

    // 3) Evaluate & get suggestion (static + AI)
    const staticSuggestion = staticEvaluate(heartRate, temperature);
    const ai = await getAiSuggestion(user, heartRate, temperature, staticSuggestion.message);

    // Save last suggestion in user.health
    user.health.lastSuggestion = {
      tag: staticSuggestion.tag,
      at: new Date(),
      message: ai.text,
      usedAI: ai.usedAI || false,
    };

    await user.save();

    // 4) Optional: send SMS for critical cases (if you have twilio util configured)
    if (staticSuggestion.severity === "critical") {
      const to = user.phone || process.env.DEFAULT_REMINDER_PHONE || null;
      if (to && typeof sendSmsImmediate === "function") {
        try {
          await sendSmsImmediate(to, `ALERT: ${staticSuggestion.title} — ${staticSuggestion.message}`);
        } catch (smsErr) {
          console.warn("Failed to send alert SMS:", smsErr?.message || smsErr);
        }
      }
    }

    return res.status(201).json({
      success: true,
      readingId: reading._id,
      suggestion: {
        severity: staticSuggestion.severity,
        tag: staticSuggestion.tag,
        title: staticSuggestion.title,
        message: ai.text,
        usedAI: ai.usedAI || false,
      },
    });
  } catch (err) {
    console.error("updateHealthData error:", err);
    return res.status(500).json({ error: "internal error" });
  }
};
