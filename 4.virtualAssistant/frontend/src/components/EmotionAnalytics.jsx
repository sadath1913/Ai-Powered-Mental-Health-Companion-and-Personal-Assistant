import React, { useEffect, useState } from "react";
import { Pie } from "react-chartjs-2";
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  Title,
  CategoryScale,
  LinearScale,
} from "chart.js";

// ✅ Register all chart elements once
ChartJS.register(ArcElement, Tooltip, Legend, Title, CategoryScale, LinearScale);

const EmotionAnalytics = () => {
  const [emotionCounts, setEmotionCounts] = useState({});

  // 🧠 Load stored emotion data and auto-refresh it
  useEffect(() => {
    const loadEmotionData = () => {
      const savedData = JSON.parse(localStorage.getItem("emotionData")) || {};
      setEmotionCounts(savedData);
    };

    // Initial load
    loadEmotionData();

    // ✅ Auto-refresh every 2 seconds (real-time updates)
    const interval = setInterval(() => {
      loadEmotionData();
      console.log("📊 Emotion data refreshed:", localStorage.getItem("emotionData"));
    }, 2000);

    // Cleanup on component unmount
    return () => clearInterval(interval);
  }, []);

  // ✅ Chart data based on latest emotions
  const chartData = {
    labels: Object.keys(emotionCounts),
    datasets: [
      {
        data: Object.values(emotionCounts),
        backgroundColor: [
          "#22d3ee",
          "#3b82f6",
          "#f59e0b",
          "#ef4444",
          "#a855f7",
          "#10b981",
          "#f472b6",
        ],
        borderColor: "rgba(255,255,255,0.3)",
        borderWidth: 1,
      },
    ],
  };

  return (
    <div className="bg-black/70 p-4 rounded-xl border border-cyan-500 w-[300px] text-white shadow-lg">
      <h3 className="font-semibold text-center mb-2 text-cyan-300">
        Emotion Analytics (Live)
      </h3>

      {Object.keys(emotionCounts).length > 0 ? (
        <Pie data={chartData} />
      ) : (
        <p className="text-gray-400 text-sm text-center">
          No emotion data detected yet...
        </p>
      )}
    </div>
  );
};

export default EmotionAnalytics;
