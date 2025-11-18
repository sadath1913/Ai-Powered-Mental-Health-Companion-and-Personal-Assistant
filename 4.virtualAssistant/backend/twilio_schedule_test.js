import 'dotenv/config';
import { scheduleSms } from "./utils/twilio.js";

const to = process.env.DEFAULT_REMINDER_PHONE;
const sendAt = new Date(Date.now() + 1000 * 60 * 6); // 6 minutes from now

(async () => {
  console.log("Testing scheduleSms to:", to, "sendAt:", sendAt.toISOString());
  const res = await scheduleSms(to, "Scheduled test from assistant at " + new Date().toISOString(), sendAt);
  console.log("scheduleSms result:", res);
  process.exit(0);
})();
