import express from "express";
import 'dotenv/config';
import connectDb from "./config/db.js";
import authRouter from "./routes/auth.routes.js";
import cors from "cors";
import cookieParser from "cookie-parser";
import userRouter from "./routes/user.routes.js";
import reminderRouter from "./routes/reminder.routes.js";
import { startReminderScheduler } from "./scheduler.js";
import { twilioStatusWebhook } from "./controllers/twilio.webhook.js";
import healthRouter from "./routes/health.routes.js";

const app = express();

const port = process.env.PORT || 5000;

// MUST COME FIRST
app.use(cors({
    origin: "http://localhost:5173",
    credentials: true
}));

// MUST COME BEFORE ROUTES
app.use(express.json());
app.use(cookieParser());

// PUBLIC webhook route
app.post("/twilio/webhook", express.urlencoded({ extended: false }), twilioStatusWebhook);

// NOW ADD ROUTES (correct order)
app.use("/api/auth", authRouter);
app.use("/api/user", userRouter);
app.use("/api/user/reminders", reminderRouter);

// Your Health API (ESP8266 data)
app.use("/api/health", healthRouter);

app.listen(8000, "0.0.0.0", () => {
    connectDb();
    console.log("server started");
    startReminderScheduler();
    console.log("Reminder scheduler started");
});
