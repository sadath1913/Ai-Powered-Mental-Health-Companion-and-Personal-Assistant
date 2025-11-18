import React, { useContext, useEffect, useRef, useState } from 'react'
import { userDataContext } from '../context/UserContext'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import aiImg from "../assets/ai.gif"
import { CgMenuRight } from "react-icons/cg";
import { RxCross1 } from "react-icons/rx";
import userImg from "../assets/user.gif"
import EmotionDetector from "../components/EmotionDetector";
import EmotionAnalytics from "../components/EmotionAnalytics";
import { analyzeTextSentiment } from "../utils/SentimentAnalyzer";

function Home() {
  const {userData,serverUrl,setUserData,getGeminiResponse,userMood,setUserMood}=useContext(userDataContext)
  const navigate=useNavigate()
  const [listening,setListening]=useState(false)
  const [userText,setUserText]=useState("")
  const [aiText,setAiText]=useState("")
  const [typedCommand, setTypedCommand] = useState("");  // ✅ for text input
  const isSpeakingRef=useRef(false)
  const recognitionRef=useRef(null)
  const [ham,setHam]=useState(false)
  const isRecognizingRef=useRef(false)
  const synth=window.speechSynthesis
  const [chat, setChat] = useState([])
  const [detectedEmotion, setDetectedEmotion] = useState(null);
  const [detectingEmotion, setDetectingEmotion] = useState(false);
  const [assistantAwake, setAssistantAwake] = useState(false);
  const wakeWord = "assistant";
  // ---------------- helper: health status ----------------
  const getHealthStatusClass = (health) => {
    if (!health) return "bg-gray-700 text-white";
    const hr = health.latestHeartRate || 0;
    const t = typeof health.latestTemperature === "number" ? health.latestTemperature : 0;
    // simple rules:
    if ((hr && (hr < 50 || hr > 110)) || (t && (t > 38 || t < 35))) return "bg-red-600 text-white";
    if ((hr && (hr < 60 || hr > 100)) || (t && (t > 37 || t < 36))) return "bg-yellow-600 text-black";
    return "bg-green-600 text-white";
  };

  const getHealthStatusText = (health) => {
    if (!health) return "No data";
    const hr = health.latestHeartRate || 0;
    const t = typeof health.latestTemperature === "number" ? health.latestTemperature : null;
    if ((hr && (hr < 50 || hr > 110)) || (t && (t > 38 || t < 35))) return "Attention";
    if ((hr && (hr < 60 || hr > 100)) || (t && (t > 37 || t < 36))) return "Watch";
    return "Normal";
  };
  const generateHealthTips = (hr, temp) => {
  if (!hr && !temp) return "Waiting for sensor data...";

  let tips = [];

  if (hr) {
    if (hr < 60) tips.push("Your heart rate is low. Try slow breathing or a short walk.");
    else if (hr > 100) tips.push("Your heart rate is high. Drink water and relax for 2–3 minutes.");
    else tips.push("Your heart rate is normal. Keep maintaining a healthy routine!");
  }

  if (typeof temp === "number") {
    if (typeof temp === "number") {
  if (temp < 36) {
    tips.push(
      "Your body temperature seems low. Keep yourself warm and monitor your condition. If you feel dizzy or weak, consider contacting a healthcare professional."
    );
  } 
  else if (temp >= 36 && temp <= 37.5) {
    tips.push(
      "Your temperature looks normal. Stay hydrated and maintain a balanced routine."
    );
  } 
  else if (temp > 37.5 && temp <= 38.5) {
    tips.push(
      "You have a mild fever. Drink warm water, rest well, and monitor your temperature. If symptoms persist, consider consulting a doctor."
    );
  } 
  else if (temp > 38.5) {
    tips.push(
      "Your temperature is high. Take rest, stay hydrated, and consider speaking with a doctor soon for proper guidance."
    );
  }
}

  }

  return tips.join(" ");
};

  // ---------------- friendlySuggestion (convert backend suggestion -> short text) ----------------
  const friendlySuggestion = (sugg) => {
    if (!sugg) return "No suggestions yet.";
    try {
      if (typeof sugg === "string") {
        const trimmed = sugg.trim();
        if ((trimmed.startsWith("{") && trimmed.endsWith("}")) || (trimmed.startsWith("[") && trimmed.endsWith("]"))) {
          const parsed = JSON.parse(trimmed);
          return parsed.response || parsed.message || JSON.stringify(parsed).slice(0, 300);
        }
        return trimmed.length > 300 ? trimmed.slice(0, 297) + "..." : trimmed;
      }
      if (typeof sugg === "object") {
        return sugg.response || sugg.message || JSON.stringify(sugg).slice(0, 300);
      }
      return String(sugg);
    } catch (err) {
      return String(sugg).replace(/\s+/g, " ").slice(0, 300);
    }
  };

  // ---------------- SuggestionBlock component (preview + expand) ----------------
  const SuggestionBlock = ({ suggestion }) => {
    // suggestion may be string, JSON object, or null
    const [expanded, setExpanded] = useState(false);

    if (!suggestion) {
      return <div className="mt-2 text-[13px] text-gray-400">No suggestions yet.</div>;
    }

    // try to get a friendly message
    let message = "";
    if (typeof suggestion === "string") {
      // if it looks like JSON, try parse
      try {
        const parsed = JSON.parse(suggestion);
        message = parsed.response || parsed.message || JSON.stringify(parsed);
      } catch {
        message = suggestion;
      }
    } else if (typeof suggestion === "object") {
      // choose the best property
      message = suggestion.response || suggestion.message || JSON.stringify(suggestion);
    } else {
      message = String(suggestion);
    }

    // sanitize and trim for preview
    const oneLine = message.replace(/\s+/g, " ").trim();
    const preview = oneLine.length > 120 ? oneLine.slice(0, 117) + "..." : oneLine;

    return (
      <div className="mt-2">
        <div className="text-[13px] text-gray-200">{expanded ? oneLine : preview}</div>
        {oneLine.length > 120 && (
          <button onClick={() => setExpanded(!expanded)} className="mt-2 text-xs text-cyan-300 underline">
            {expanded ? "Show less" : "Read more"}
          </button>
        )}
      </div>
    );
  };

  const handleClearChat = () => setChat([])
  const lastRequestRef = useRef("");
  const requestInFlightRef = useRef(false);
    const toggleEmotionDetection = () => {
      setDetectingEmotion(prev => !prev);
      if (!detectingEmotion) {
        console.log("🎥 Emotion detection started");
      } else {
        console.log("🛑 Emotion detection stopped");
      }
    };


  const handleLogOut=async ()=>{
    try {
      const result=await axios.get(`${serverUrl}/api/auth/logout`,{withCredentials:true})
      setUserData(null)
      navigate("/signin")
    } catch (error) {
      setUserData(null)
      console.log(error)
    }
  }

  const startRecognition = () => {
    
   if (!isSpeakingRef.current && !isRecognizingRef.current) {
    try {
      recognitionRef.current?.start();
      console.log("Recognition requested to start");
    } catch (error) {
      if (error.name !== "InvalidStateError") {
        console.error("Start error:", error);
      }
    }
  }
    
  }

  const speak=(text)=>{
    const utterence=new SpeechSynthesisUtterance(text)
    utterence.lang = 'hi-IN';
    const voices =window.speechSynthesis.getVoices()
    const hindiVoice = voices.find(v => v.lang === 'hi-IN');
    if (hindiVoice) {
      utterence.voice = hindiVoice;
    }


    isSpeakingRef.current=true
    utterence.onend=()=>{
        setAiText("");
  isSpeakingRef.current = false;
  setTimeout(() => {
    startRecognition(); // ⏳ Delay se race condition avoid hoti hai
  }, 800);
    }
   synth.cancel(); // 🛑 pehle se koi speech ho to band karo
synth.speak(utterence);
  }
  const wakeAssistant = () => {
    if (!assistantAwake) {
      setAssistantAwake(true);
      speak(`Hello ${userData.name}, I'm ready to help you.`);
      startRecognition();
    }
  };


  const handleCommand = (data) => {
    // keep original destructuring but allow response to be replaced
    const { type, userInput } = data;
    let response = data.response; // changed from const to let so we can sanitize if needed
  
    // --- NEW: If backend returned reminders array, build a friendly response WITHOUT raw _id ---
    if (Array.isArray(data.reminders) && data.reminders.length > 0) {
      const lines = data.reminders.map((r, idx) => {
        const when = r.dueAt ? new Date(r.dueAt).toLocaleString() : "no time set";
        return `${idx + 1}. ${r.title} at ${when}${r.sentAt ? " (sent)" : ""}`;
      });
      response = `Your reminders:\n${lines.join("\n")}`;
    }
    // -------------------------------------------------------------------------
  
    if (!response || response.trim().length === 0) return;
  
    // ignore responses that look like instruction-only (heuristic)
    const low = response.toLowerCase();
    if (low.includes("only respond with the json object") || low.includes("do not include any explanation")) {
      console.log("Ignoring instruction-like response from Gemini:", response);
      return;
    }
    console.log("🧠 Handling command type:", type, "Response:", response);
    setChat(prev => [
      ...prev,
      { sender: "user", text: userInput },
      { sender: "ai", text: response }
    ])
    // 🩵 Always speak if valid response exists
    if (response && response.trim() !== "") {
      if (type === "mental-health") {
        // 🧠 Detect mood based on keywords
        let detectedMood = "neutral";
  
        const input = userInput.toLowerCase();
        if (input.includes("sad") || input.includes("depressed")) detectedMood = "sad";
        else if (input.includes("anxious") || input.includes("worried")) detectedMood = "anxious";
        else if (input.includes("lonely")) detectedMood = "lonely";
        else if (input.includes("tired") || input.includes("stressed")) detectedMood = "stressed";
        else if (input.includes("angry") || input.includes("frustrated")) detectedMood = "angry";
        else if (input.includes("happy") || input.includes("better")) detectedMood = "happy";
  
        // 🧩 Save the mood in context
        setUserMood(detectedMood);
        console.log("🩵 Detected mood:", detectedMood);
  
        speak(response);
        return; // stop here
      }
  
      // 🧠 If not a mental health query, recall last mood (if any)
      if (userMood && userMood !== "neutral") {
        const followUp = `By the way, I remember you mentioned feeling ${userMood} earlier. Are you feeling a bit better now?`;
        speak(`${response} ${followUp}`);
        setChat(prev => [...prev, { sender: "ai", text: followUp }])
      } else {
        speak(response);
      }
    }
  
      
    switch (type) {
      case 'mental-health':
        console.log("🧠 Mental health query detected:", response);
        // only speak, no window open
        break;
  
      case 'google-search':
        window.open(`https://www.google.com/search?q=${encodeURIComponent(userInput)}`, '_blank');
        break;
  
      case 'calculator-open':
        window.open(`https://www.google.com/search?q=calculator`, '_blank');
        break;
  
      case 'instagram-open':
        window.open(`https://www.instagram.com/`, '_blank');
        break;
  
      case 'facebook-open':
        window.open(`https://www.facebook.com/`, '_blank');
        break;
  
      case 'weather-show':
        window.open(`https://www.google.com/search?q=weather`, '_blank');
        break;
  
      case 'youtube-search':
      case 'youtube-play':
        window.open(`https://www.youtube.com/results?search_query=${encodeURIComponent(userInput)}`, '_blank');
        break;
  
      default:
        // No special action
        break;
    }
  };
  // ---------------- Suggestion action handlers ----------------
  const acknowledgeSuggestion = async () => {
    // optional: send ack to backend (record user acknowledged)
    try {
      await axios.post(`${serverUrl}/api/user/health/suggestion/ack`, { userId: userData._id }, { withCredentials: true });
    } catch (err) {
      // ignore
    }
    setChat(prev => [...prev, { sender: "ai", text: "Suggestion acknowledged." }]);
  };

  const snoozeSuggestion = async (minutes = 10) => {
    try {
      await axios.post(`${serverUrl}/api/user/health/suggestion/snooze`, { userId: userData._id, minutes }, { withCredentials: true });
      setChat(prev => [...prev, { sender: "ai", text: `Snoozed for ${minutes} minutes.` }]);
    } catch (err) {
      setChat(prev => [...prev, { sender: "ai", text: `Failed to snooze.` }]);
    }
  };

  const ignoreSuggestion = async () => {
    try {
      await axios.post(`${serverUrl}/api/user/health/suggestion/ignore`, { userId: userData._id }, { withCredentials: true });
    } catch (err) {
      // ignore
    }
    setChat(prev => [...prev, { sender: "ai", text: "Suggestion ignored." }]);
  };

  // ✅ Text command trigger (typed input)
  const handleTextCommand = async () => {
    if (!typedCommand.trim()) return;
    if (requestInFlightRef.current) return;
    requestInFlightRef.current = true;
    try {
      const input = typedCommand.trim();
      const sentimentType = analyzeTextSentiment(input);
      if (sentimentType === "negative") {
        speak("I sense you're not feeling great. Remember, it's okay to take a break.");
        setChat(prev => [...prev, { sender: "ai", text: "You seem a bit down, I'm here for you 💙" }]);
      } else if (sentimentType === "positive") {
        speak("You sound happy! That’s great to hear!");
        setChat(prev => [...prev, { sender: "ai", text: "Glad you're feeling good today 😊" }]);
      }
      setUserText(input);
      setAiText("Thinking...");
      const data = await getGeminiResponse(input);
      console.log("🧩 Gemini Response:", data);
      setAiText(data.response || "Hmm, I’m not sure what you mean.");
      handleCommand(data);
    } catch (err) {
      console.error("handleTextCommand error:", err);
      setAiText("Something went wrong, please try again.");
      speak("Something went wrong, please try again.");
    } finally {
      requestInFlightRef.current = false;
      setTypedCommand("");
    }
  };
  
useEffect(() => {
  if (!userMood || userMood === "neutral") return;

  const mood = userMood.split("_")[0];
  console.log("🧠 Processed mood:", mood);

  const emotionResponses = {
    happy: ["You look cheerful today! I'm glad to see that. Tough times never last, but tough people do. You’re stronger than you think 💪😊 "],
    sad: ["Hey, it’s okay to feel down sometimes. I’m right here with you 🤍"],
    angry: ["Hey Why are Angry. Cool Down,Take a deep breath. Anger is like holding a hot coal — drop it to find peace. Want me to play some relaxing music for you? 😌"],
    surprised: ["Woah! You look surprised 😲 — what happened?"],
    fearful: ["It’s okay, you’re safe with me 💙"],
    tired: ["You seem tired. Remember to take breaks and rest well 🛌"],
    anxious:["You’re safe right now. Take a deep breath. You’ve got this! I’m here for you 🤗"],
    disgusted: ["Hmm, something bothering you? Want to talk about it?"],
  };

 if (emotionResponses[mood]) {
    const responses = emotionResponses[mood];
    const randomResponse = responses[Math.floor(Math.random() * responses.length)];

    // 🎙️ Speak and show response
    speak(randomResponse);
    setChat((prev) => [...prev, { sender: "ai", text: randomResponse }]);
  }
}, [userMood]);
// ------------------------
// Poll backend for latest user snapshot (health updates)
// ------------------------
useEffect(() => {
  let mounted = true;
  const POLL_MS = 5000; // poll every 5s (adjust if needed)
  let timer = null;

  const fetchUserSnapshot = async () => {
    try {
      const res = await axios.get(`${serverUrl}/api/user/current`, { withCredentials: true });
      if (!mounted) return;
      // Only update if different to avoid rerenders
      if (JSON.stringify(res.data) !== JSON.stringify(userData)) {
        setUserData(res.data);
      }
    } catch (err) {
      // silently ignore network glitches
      // console.warn("Snapshot poll error:", err);
    } finally {
      timer = setTimeout(fetchUserSnapshot, POLL_MS);
    }
  };

  fetchUserSnapshot();

  return () => {
    mounted = false;
    if (timer) clearTimeout(timer);
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, []); // run once on mount

useEffect(() => {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const recognition = new SpeechRecognition();

  recognition.continuous = true;
  recognition.lang = 'en-US';
  recognition.interimResults = false;

  recognitionRef.current = recognition;

  recognition.onstart = () => {
    setListening(true);
    console.log("🎧 Recognition started");
  };

  recognition.onend = () => {
    setListening(false);
    console.log("🛑 Recognition stopped");
  };

  recognition.onerror = (event) => {
    console.warn("Recognition error:", event.error);
  };

  recognition.onresult = async (e) => {
    try {
      const transcript = e.results[e.results.length - 1][0].transcript.trim().toLowerCase();
  
      // --- 1) Debounce duplicate transcripts (short window) ---
      if (lastRequestRef.current === transcript) {
        console.log("Duplicate transcript detected, ignoring.");
        return;
      }
      lastRequestRef.current = transcript;
      // clear after 5 seconds so same phrase later is allowed
      setTimeout(() => {
        if (lastRequestRef.current === transcript) lastRequestRef.current = "";
      }, 5000);
  
      // --- 2) Prevent concurrent requests ---
      if (requestInFlightRef.current) {
        console.log("Request already in-flight, ignoring this input.");
        return;
      }
      requestInFlightRef.current = true;
  
      // 🎤 Sentiment analysis for spoken text (existing)
      const sentimentType = analyzeTextSentiment(transcript);
      console.log("🎙️ Voice Sentiment Detected:", sentimentType);
  
      if (sentimentType === "negative") {
        speak("You sound a little upset. Want to talk or listen to something calming?");
        setChat((prev) => [...prev, { sender: "ai", text: "You sound a bit low — I’m here if you need to talk 💬" }]);
      } else if (sentimentType === "positive") {
        speak("You sound cheerful today! That makes me happy too!");
        setChat((prev) => [...prev, { sender: "ai", text: "I love that energy 😊" }]);
      }
  
      console.log("🎤 Heard:", transcript);
  
      // 🧠 Wake word trigger (existing)
      if (transcript.includes(wakeWord) && !assistantAwake) {
        wakeAssistant();
        return;
      }
  
      // 💤 Sleep word trigger (existing)
      if (assistantAwake && (transcript.includes("sleep") || transcript.includes("stop listening"))) {
        setAssistantAwake(false);
        speak("Okay, I'll stop listening.");

        try { recognition.stop(); } catch (err) { /* ignore */ }
        return;
      }
  
      // If assistant is awake, process the command
      if (assistantAwake) {
        setUserText(transcript);
        try { recognition.stop(); } catch (err) { /* ignore */ }
  
        // Call backend once — guarded by requestInFlightRef
        const data = await getGeminiResponse(transcript);
  
        // Small defensive check: ignore instruction-like Gemini responses that are meta
        const responseText = (data?.response || "").toString();
        const lowResp = responseText.toLowerCase();
        if (lowResp.includes("only respond with the json") || lowResp.includes("do not include any explanation") || lowResp.includes("remember to only respond")) {
          console.log("Ignored meta/instructional response from Gemini:", responseText);
          // still show fallback message if desired
          setAiText("Okay — I processed that.");
          // release the in-flight flag and return
          requestInFlightRef.current = false;
          return;
        }
  
        // Existing handling
        handleCommand(data);
        setAiText(responseText);
        setUserText("");
      }
    } catch (err) {
      console.error("recognition.onresult handler error:", err);
    } finally {
      // ensure flag cleared so future requests can run
      requestInFlightRef.current = false;
    }
  };
  
}, [assistantAwake]);



  return (
    <div className='w-full h-[100vh] bg-gradient-to-t from-[black] to-[#02023d] flex justify-center items-center flex-col gap-[15px] overflow-hidden'>

      {/* 🆕 Added: Sidebar with last 6 chat items */}
      <div className='hidden lg:flex flex-col fixed left-0 top-0 h-full w-[250px] bg-gradient-to-b from-[#00004b] to-[#000000] text-white p-4 shadow-[4px_0_10px_rgba(0,0,0,0.5)]'>
        <h2 className='font-semibold text-lg mb-2'>Recent Commands</h2>
        <div className='flex flex-col gap-2 overflow-y-auto h-[75vh]'>
          {chat.slice(-6).map((msg, i) => (
            <div key={i} className={`text-sm ${msg.sender === "user" ? "text-cyan-400" : "text-gray-300"}`}>
              {msg.sender === "user" ? "🧍 " : "🤖 "} {msg.text}
            </div>
          ))}
        </div>
        {chat.length > 0 && (
          <button onClick={handleClearChat} className='mt-4 bg-red-500 hover:bg-red-600 text-white py-2 rounded'>
            Clear Chat
          </button>
        )}
      </div>
      {/* 🆕 End Sidebar */}
   
      <CgMenuRight className='lg:hidden text-white absolute top-[20px] right-[20px] w-[25px] h-[25px]' onClick={()=>setHam(true)}/>
      <div className={`absolute lg:hidden top-0 w-full h-full bg-[#00000053] backdrop-blur-lg p-[20px] flex flex-col gap-[20px] items-start ${ham?"translate-x-0":"translate-x-full"} transition-transform`}>
 <RxCross1 className=' text-white absolute top-[20px] right-[20px] w-[25px] h-[25px]' onClick={()=>setHam(false)}/>
 <button className='min-w-[150px] h-[60px]  text-black font-semibold   bg-white rounded-full cursor-pointer text-[19px] ' onClick={handleLogOut}>Log Out</button>
      <button className='min-w-[150px] h-[60px]  text-black font-semibold  bg-white  rounded-full cursor-pointer text-[19px] px-[20px] py-[10px] ' onClick={()=>navigate("/customize")}>Customize your Assistant</button>

<div className='w-full h-[2px] bg-gray-400'></div>
<h1 className='text-white font-semibold text-[19px]'>History</h1>

<div className='w-full h-[400px] gap-[20px] overflow-y-auto flex flex-col truncate'>
  {userData.history?.map((his)=>(
    <div className='text-gray-200 text-[18px] w-full h-[30px]  '>{his}</div>
  ))}

</div>

      </div>
      <button className='min-w-[150px] h-[60px] mt-[30px] text-black font-semibold absolute hidden lg:block top-[20px] right-[20px]  bg-white rounded-full cursor-pointer text-[19px] ' onClick={handleLogOut}>Log Out</button>
      <button className='min-w-[150px] h-[60px] mt-[30px] text-black font-semibold  bg-white absolute top-[100px] right-[20px] rounded-full cursor-pointer text-[19px] px-[20px] py-[10px] hidden lg:block ' onClick={()=>navigate("/customize")}>Customize your Assistant</button>
      <div className='w-[300px] h-[400px] flex justify-center items-center overflow-hidden rounded-4xl shadow-lg'>
      <img src={userData?.assistantImage} alt="" className='h-full object-cover'/>
      </div>
      {/* ---------------- Compact Health Chip (center, under assistant image) ---------------- */}
      <div className="mt-4 flex justify-center w-full">
        <div className="bg-black/60 border border-cyan-500/20 px-5 py-3 rounded-full flex items-center gap-6 shadow-md max-w-[420px]">
          <div className="flex flex-col items-center">
            <div className="text-xs text-gray-400">Heart Rate</div>
            <div className="text-xl font-bold text-white">{userData?.health?.latestHeartRate ? `${userData.health.latestHeartRate} BPM` : "-- BPM"}</div>
          </div>

          <div className="w-[1px] h-10 bg-cyan-500/20" />

          <div className="flex flex-col items-center">
            <div className="text-xs text-gray-400">Temperature</div>
            <div className="text-xl font-bold text-white">{typeof userData?.health?.latestTemperature === "number" ? `${userData.health.latestTemperature.toFixed(1)} °C` : "-- °C"}</div>
          </div>

          <div className="ml-4">
            <div className={`h-3 w-3 rounded-full ${getHealthStatusClass(userData?.health)}`} title={getHealthStatusText(userData?.health)}></div>
          </div>

        </div>
      </div>
      {/* ---------------- end compact chip ---------------- */}
      
      
      {/* 🧠 Face Emotion Detector Preview */}
      <div className="absolute bottom-6 right-6 flex flex-col items-center gap-2">
        {/* 🎥 Toggle button */}
        <button
          onClick={toggleEmotionDetection}
          className={`px-4 py-2 rounded-full text-sm font-semibold shadow-lg transition-all duration-300 ${
            detectingEmotion
              ? "bg-red-600 hover:bg-red-700 text-white"
              : "bg-cyan-500 hover:bg-cyan-600 text-white"
          }`}
        >
          {detectingEmotion ? "Stop Emotion Detection" : "Start Emotion Detection"}
        </button>

        {/* 🧠 Only show detector when active */}
        {detectingEmotion && (
          <>
            <div className="bg-black/60 rounded-lg p-2 border border-cyan-500/40 shadow-[0_0_10px_rgba(0,255,255,0.4)]">
              <EmotionDetector
                active={detectingEmotion}
                onEmotionDetected={(emotion) => {
                  console.log("🧠 Emotion callback received:", emotion);
                  setUserMood((prev) => {
                    if (prev !== emotion) return `${emotion}_${Date.now()}`;
                    return emotion;
                  });
                  setDetectedEmotion(emotion);
                }}
              />
            </div>

            {/* 📊 Emotion Analytics Dashboard */}
            <EmotionAnalytics />
          </>
        )}
      </div>


      <h1 className='text-white text-[18px] font-semibold'>I'm {userData?.assistantName}</h1>
      {detectedEmotion && (
        <h2 className="text-cyan-300 text-[17px] mt-1 flex items-center gap-2 animate-pulse">
          Detected emotion:{" "}
          <span className="font-semibold text-white flex items-center gap-1">
            {detectedEmotion}{" "}
            <span>
              {detectedEmotion === "happy" && "😊"}
              {detectedEmotion === "sad" && "😢"}
              {detectedEmotion === "angry" && "😠"}
              {detectedEmotion === "surprised" && "😮"}
              {detectedEmotion === "fearful" && "😨"}
              {detectedEmotion === "disgusted" && "🤢"}
              {detectedEmotion === "neutral" && "😐"}
            </span>
          </span>
        </h2>
      )}


      {!aiText && <img src={userImg} alt="" className='w-[200px]'/>}
      {aiText && <img src={aiImg} alt="" className='w-[200px]'/>}
    
   
   {/* 🆕 Health Tips Box */}
    <div className="w-[85%] max-w-[450px] bg-black/60 border border-cyan-400/20 rounded-lg mt-4 p-4 shadow-lg">
      
      <div className="text-cyan-300 font-semibold mb-2 text-center">
        Health Tips
      </div>

      <div className="text-gray-200 text-[14px] leading-relaxed">
        {generateHealthTips(
          userData?.health?.latestHeartRate,
          userData?.health?.latestTemperature
        )}
      </div>

      <div className="mt-3 text-xs text-gray-400 text-center">
        Updated: {userData?.health?.updatedAt ? new Date(userData.health.updatedAt).toLocaleTimeString() : "—"}
      </div>

    </div>
    {/* 🆕 End Health Tips Box */}


      {/* 🆕 End Chat Preview */}

    {/* Text Command Input Section */}
      <div className="flex items-center justify-center mt-6 space-x-3">
        <input
          type="text"
          value={typedCommand}
          onChange={(e) => setTypedCommand(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleTextCommand();
          }}
          onFocus={() => recognitionRef.current?.stop()}
          onBlur={() => startRecognition()}
          placeholder="Type your command..."
          className="flex-grow max-w-md h-[55px] rounded-full px-6 text-[17px] text-white bg-transparent border-2 border-cyan-400/60 focus:border-cyan-300 focus:ring-2 focus:ring-cyan-500 outline-none placeholder-gray-400 shadow-[0_0_15px_rgba(0,255,255,0.3)] transition-all duration-300"
        />
        
        <button
          onClick={handleTextCommand}
          className="px-6 h-[55px] rounded-full bg-gradient-to-r from-cyan-400 to-blue-600 text-white font-semibold shadow-[0_0_15px_rgba(0,255,255,0.4)] hover:shadow-[0_0_25px_rgba(0,255,255,0.6)] active:scale-95 transition-all duration-300"
        >
          Send
        </button>
        <button
          onClick={wakeAssistant}
          className={`px-6 h-[55px] rounded-full font-semibold transition-all duration-300 ${
            assistantAwake ? "bg-red-500 hover:bg-red-600" : "bg-green-500 hover:bg-green-600"
          } text-white`}
        >
          {assistantAwake ? "Stop" : "Wake Assistant"}
        </button>

      </div>


    </div>
  )
}

export default Home