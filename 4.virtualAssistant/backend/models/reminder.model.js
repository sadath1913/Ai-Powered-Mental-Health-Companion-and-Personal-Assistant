// backend/models/reminder.model.js
import mongoose from "mongoose";

const reminderSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  title: { type: String, required: true },
  tag: { type: String },
  dueAt: { type: Date, required: true },
  toNumber: { type: String }, // E.164 recipient phone number (optional)
  sentAt: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now },
  twilioScheduledSid: { type: String, default: null }, // Twilio scheduled message SID (if scheduled)
  autoSent: { type: Boolean, default: false }, // whether Twilio/server auto-sent
}, { timestamps: true });

const Reminder = mongoose.model("Reminder", reminderSchema);
export default Reminder;
