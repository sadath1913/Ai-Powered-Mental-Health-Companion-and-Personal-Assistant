import Reminder from "../models/reminder.model.js";

export const twilioStatusWebhook = async (req, res) => {
  try {
    const sid = req.body.MessageSid || req.body.SmsSid;
    const status = req.body.MessageStatus || req.body.SmsStatus;

    console.log("➡ Twilio Webhook:", sid, status);

    if (!sid) return res.sendStatus(200);

    const reminder = await Reminder.findOne({ twilioScheduledSid: sid });
    if (!reminder) return res.sendStatus(200);

    if (status === "sent" || status === "delivered") {
      reminder.sentAt = new Date();
      reminder.autoSent = true;
    } else if (status === "failed" || status === "undelivered") {
      reminder.sentAt = new Date();
      reminder.autoSent = false;
      reminder.errorMessage = status;
    }

    await reminder.save();
    return res.sendStatus(200);
  } catch (err) {
    console.error("twilio webhook error:", err);
    return res.sendStatus(500);
  }
};
