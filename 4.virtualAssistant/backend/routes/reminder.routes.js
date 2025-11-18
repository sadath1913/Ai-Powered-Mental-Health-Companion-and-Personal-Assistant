// backend/routes/reminder.routes.js
import express from "express";
import { createReminder, listReminders, deleteReminder } from "../controllers/reminder.controllers.js";
import isAuth from "../middlewares/isAuth.js";

const router = express.Router();

router.get("/", isAuth, listReminders);
router.post("/", isAuth, createReminder);
router.delete("/:id", isAuth, deleteReminder);

export default router;
