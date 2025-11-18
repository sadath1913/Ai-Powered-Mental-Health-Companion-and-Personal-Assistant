// backend/middleware/deviceAuth.js
// Simple device authentication middleware - checks x-device-key header
export default function deviceAuth(req, res, next) {
  try {
    const key = req.headers["x-device-key"] || req.headers["X-Device-Key"] || req.query.deviceKey;
    const expected = process.env.DEVICE_API_KEY || null;

    if (!expected) {
      // If no expected key set, allow by default (useful for local dev)
      console.warn("Warning: DEVICE_API_KEY not set in .env — deviceAuth allowing all devices.");
      return next();
    }

    if (!key || key !== expected) {
      return res.status(401).json({ message: "unauthorized device" });
    }

    // attach device info if needed
    req.deviceKey = key;
    return next();
  } catch (err) {
    console.error("deviceAuth error:", err);
    return res.status(500).json({ message: "deviceAuth error" });
  }
}
