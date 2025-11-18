// frontend/src/context/UserContext.jsx
import axios from '../axiosConfig'
import React, { createContext, useEffect, useState } from 'react'
export const userDataContext = createContext()

function UserContext({ children }) {
  const serverUrl = "http://localhost:8000"
  const [userData, setUserData] = useState(null)
  const [frontendImage, setFrontendImage] = useState(null)
  const [backendImage, setBackendImage] = useState(null)
  const [selectedImage, setSelectedImage] = useState(null)

  const [userMood, setUserMood] = useState("neutral");

  const handleCurrentUser = async () => {
    try {
      const result = await axios.get(`${serverUrl}/api/user/current`, { withCredentials: true })
      setUserData(result.data)
      console.log("current user:", result.data)
    } catch (error) {
      console.log("handleCurrentUser error:", error)
    }
  }

  const getGeminiResponse = async (command) => {
    try {
      const result = await axios.post(
        `${serverUrl}/api/user/asktoassistant`,
        { command },
        { withCredentials: true }
      );

      let parsedResult = result.data;

      // parse stringified JSON responses from backend if necessary
      if (typeof parsedResult === "string") {
        try {
          parsedResult = JSON.parse(parsedResult);
        } catch (err) {
          console.warn("⚠️ Could not parse Gemini response:", parsedResult);
          parsedResult = {
            type: "general",
            userInput: command,
            response: parsedResult || "I'm here for you.",
          };
        }
      }

      // ensure a fallback valid response
      if (!parsedResult || !parsedResult.response) {
        parsedResult = {
          type: parsedResult?.type || "general",
          userInput: command,
          response: "I'm here for you. Can you please repeat that?",
        };
      }

      console.log("✅ Final Gemini Response:", parsedResult);
      return parsedResult;
    } catch (error) {
      console.error("❌ Gemini response error:", error);
      return {
        type: "general",
        userInput: command,
        response: "Something went wrong while processing your request.",
      };
    }
  };

  // -----------------------------
  // Reminder API helpers
  // -----------------------------
  // Create a reminder:
  // { text: "Remind me to take aspirin at 2pm", dueAtIso: optional ISO string, toNumber: optional E.164 phone, tag: optional }
  const createReminderApi = async ({ text, dueAtIso, toNumber, tag }) => {
    try {
      const res = await axios.post(
        `${serverUrl}/api/user/reminders`,
        { text, dueAt: dueAtIso, toNumber, tag },
        { withCredentials: true }
      );
      return res.data;
    } catch (err) {
      console.error("createReminderApi error:", err);
      throw err;
    }
  };

  // List reminders
  const getRemindersApi = async () => {
    try {
      const res = await axios.get(`${serverUrl}/api/user/reminders`, { withCredentials: true });
      return res.data;
    } catch (err) {
      console.error("getRemindersApi error:", err);
      return [];
    }
  };

  // Delete reminder by id
  const deleteReminderApi = async (id) => {
    try {
      const res = await axios.delete(`${serverUrl}/api/user/reminders/${id}`, { withCredentials: true });
      return res.data;
    } catch (err) {
      console.error("deleteReminderApi error:", err);
      throw err;
    }
  };

  useEffect(() => {
    if (userMood) {
      const timer = setTimeout(() => setUserMood(null), 1000 * 60 * 30);
      return () => clearTimeout(timer);
    }
  }, [userMood]);

  useEffect(() => {
    handleCurrentUser()
  }, [])

  const value = {
    serverUrl,
    userData,
    setUserData,
    backendImage,
    setBackendImage,
    frontendImage,
    setFrontendImage,
    selectedImage,
    setSelectedImage,
    getGeminiResponse,
    userMood,
    setUserMood,
    // reminders
    createReminderApi,
    getRemindersApi,
    deleteReminderApi
  }

  return (
    <userDataContext.Provider value={value}>
      {children}
    </userDataContext.Provider>
  )
}

export default UserContext
