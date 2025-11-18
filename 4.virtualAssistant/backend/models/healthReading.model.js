// backend/models/healthReading.model.js
import mongoose from "mongoose";

const HealthReadingSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  heartRate: { type: Number, required: true },
  temperature: { type: Number, required: true },
  source: { type: String, default: "esp8266" },
  createdAt: { type: Date, default: () => new Date(), index: true }
}, { versionKey: false });

// Optional TTL: keep readings for 7 days (change or remove if you don't want TTL)
HealthReadingSchema.index({ createdAt: 1 }, { expireAfterSeconds: 7 * 24 * 3600 });

HealthReadingSchema.index({ user: 1, createdAt: -1 });

export default mongoose.model("HealthReading", HealthReadingSchema);
