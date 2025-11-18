// backend/scheduler.js
import { sendDueReminders } from "./controllers/reminder.controllers.js";

export const startReminderScheduler = (intervalMs = 60 * 1000) => {
  const runner = async () => {
    try {
      const count = await sendDueReminders();
      if (count > 0) console.log(`sendDueReminders processed ${count} reminders`);
    } catch (err) {
      console.error("Reminder scheduler error:", err);
    }
  };
  runner();
  const id = setInterval(runner, intervalMs);
  return id;
};
