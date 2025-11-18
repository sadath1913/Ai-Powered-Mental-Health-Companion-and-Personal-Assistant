// backend/utils/twilio.js
import Twilio from "twilio";

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const fromNumber = process.env.TWILIO_PHONE_NUMBER || null;

if (!accountSid || !authToken) {
  console.error("CRITICAL: Twilio credentials missing. Please set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN in .env");
}

const client = Twilio(accountSid || "", authToken || "");

/**
 * scheduleSms - schedule a message using Messaging Service SID
 */
export async function scheduleSms(to, body, sendAt) {
  try {
    if (!to) throw new Error("No 'to' number provided to scheduleSms");
    if (!sendAt || !(sendAt instanceof Date) || isNaN(sendAt)) {
      throw new Error("Invalid sendAt date passed to scheduleSms");
    }

    const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID || null;
    const now = new Date();
    const minDiffSec = 300; // 5 minutes
    const maxDiffSec = 3060000; // 35 days

    const diffSec = Math.floor((sendAt.getTime() - now.getTime()) / 1000);

    if (diffSec < 0) {
      console.log("scheduleSms: sendAt is in the past — sending immediately");
      if (!fromNumber) throw new Error("No TWILIO_PHONE_NUMBER set for immediate send");
      return await client.messages.create({ to, from: fromNumber, body });
    }

    let finalSendAt = sendAt;
    if (diffSec < minDiffSec) {
      finalSendAt = new Date(now.getTime() + minDiffSec * 1000);
      console.log(`scheduleSms: sendAt too soon. Auto-bumping to ${finalSendAt.toISOString()}`);
    } else if (diffSec > maxDiffSec) {
      throw new Error("SendAt time is too far in the future (>35 days).");
    }

    if (!messagingServiceSid) {
      throw new Error("MessagingServiceSid is required to schedule a message. Set TWILIO_MESSAGING_SERVICE_SID in .env");
    }

    const msg = await client.messages.create({
      to,
      messagingServiceSid,
      body,
      scheduleType: "fixed",
      sendAt: finalSendAt.toISOString(),
    });

    return msg;
  } catch (err) {
    console.error("scheduleSms error:", err && (err.message || err));
    return { error: err };
  }
}

/**
 * sendSmsImmediate - send an SMS immediately
 */
export async function sendSmsImmediate(to, body) {
  try {
    if (!to) throw new Error("No 'to' number provided to sendSmsImmediate");

    const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID || null;

    const params = { to, body };
    if (fromNumber) params.from = fromNumber;
    else if (messagingServiceSid) params.messagingServiceSid = messagingServiceSid;
    else throw new Error("No TWILIO_PHONE_NUMBER set for immediate sends and no TWILIO_MESSAGING_SERVICE_SID available");

    const msg = await client.messages.create(params);
    return msg;
  } catch (err) {
    console.error("sendSmsImmediate error:", err && (err.message || err));
    return { error: err };
  }
}

/**
 * cancelScheduledSms - cancel scheduled message by sid
 */
export async function cancelScheduledSms(sid) {
  try {
    if (!sid) throw new Error("No sid provided to cancelScheduledSms");
    const res = await client.messages(sid).update({ status: "canceled" });
    return res;
  } catch (err) {
    console.error("cancelScheduledSms error:", err && (err.message || err));
    return { error: err };
  }
}
