import express from "express";
import { updateHealthData } from "../controllers/health.controller.js";
import deviceAuth from "../middlewares/deviceAuth.js";

const router = express.Router();
router.post("/update", deviceAuth, updateHealthData);
export default router;
