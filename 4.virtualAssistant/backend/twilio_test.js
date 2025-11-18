// twilio_test.js — run with: node twilio_test.js
import 'dotenv/config';
import { sendSmsImmediate } from "./utils/twilio.js";
const to = process.env.DEFAULT_REMINDER_PHONE;
(async () => {
  console.log("Testing sendSmsImmediate to:", to);
  const res = await sendSmsImmediate(to, "Test SMS from assistant at " + new Date().toISOString());
  console.log("sendSmsImmediate result:", res);
  process.exit(0);
})();
