import React, { useEffect, useRef, useState } from "react";
import * as faceapi from "face-api.js";
import "@tensorflow/tfjs";
import "@tensorflow/tfjs-backend-webgl";

const EmotionDetector = ({ onEmotionDetected, active }) => {
  const videoRef = useRef(null);
  const [initialized, setInitialized] = useState(false);
  const [currentEmotion, setCurrentEmotion] = useState("Waiting...");
  const detectionInterval = 10000; // detect every 10 sec
  const [intervalId, setIntervalId] = useState(null);

  // ✅ Load models once
  useEffect(() => {
    const loadModels = async () => {
      try {
        console.log("✅ Loading models from:", `${window.location.origin}/models`);
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(`${window.location.origin}/models`),
          faceapi.nets.faceExpressionNet.loadFromUri(`${window.location.origin}/models`)
        ]);
        console.log("✅ face-api models loaded successfully");
        setInitialized(true);
      } catch (err) {
        console.error("❌ Error loading models:", err);
      }
    };
    loadModels();
  }, []);

  // ✅ Start or stop camera based on button toggle
  useEffect(() => {
    if (!initialized) return;

    if (active) {
      navigator.mediaDevices.getUserMedia({ video: true })
        .then((stream) => {
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            console.log("📸 Camera started");
          }
        })
        .catch((err) => console.error("Camera access error:", err));
    } else {
      // Stop camera stream
      if (videoRef.current?.srcObject) {
        videoRef.current.srcObject.getTracks().forEach((t) => t.stop());
        videoRef.current.srcObject = null;
        console.log("🛑 Camera stopped");
      }
      // Stop detection interval
      if (intervalId) clearInterval(intervalId);
    }
  }, [active, initialized]);

  // ✅ Detection logic runs every 10 seconds
  useEffect(() => {
    if (!initialized || !active) return;

    const detectEmotion = async () => {
      if (!videoRef.current) return;
      console.log("🕒 Checking emotion...");

      try {
        const detections = await faceapi
          .detectSingleFace(videoRef.current, new faceapi.TinyFaceDetectorOptions())
          .withFaceExpressions();

        if (detections && detections.expressions) {
          const emotions = detections.expressions;
          const topEmotion = Object.keys(emotions).reduce((a, b) =>
            emotions[a] > emotions[b] ? a : b
          );

          if (emotions[topEmotion] > 0.5) {
            console.log("🎭 Detected:", topEmotion);
            const emotionData = JSON.parse(localStorage.getItem("emotionData")) || {};
            emotionData[topEmotion] = (emotionData[topEmotion] || 0) + 1;
            localStorage.setItem("emotionData", JSON.stringify(emotionData));
            onEmotionDetected(topEmotion);
          }

        }
      } catch (error) {
        console.error("⚠️ Emotion detection failed:", error.message);
      }
    };

    // Run immediately once, then every 10 sec
    detectEmotion();
    const id = setInterval(detectEmotion, detectionInterval);
    setIntervalId(id);

    return () => clearInterval(id);
  }, [initialized, active]);

  return (
    <div className="flex flex-col items-center">
      <video
        ref={videoRef}
        autoPlay
        muted
        width="220"
        height="160"
        className="rounded-xl border border-cyan-400/50 shadow-[0_0_10px_rgba(0,255,255,0.2)]"
      />
      <p className="text-cyan-300 text-sm mt-2 font-semibold">
        {active ? `😊 Emotion: ${currentEmotion}` : "Detection paused"}
      </p>
    </div>
  );
};

export default EmotionDetector;
