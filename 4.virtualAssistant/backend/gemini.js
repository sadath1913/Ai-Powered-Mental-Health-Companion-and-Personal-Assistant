import axios from "axios"
const geminiResponse=async (command,assistantName,userName)=>{
try {
    const apiUrl=process.env.GEMINI_API_URL
    const lowerCmd = command.toLowerCase();

    // 🚨 Crisis Detection (suicidal / emergency phrases)
    const crisisKeywords = [
      "suicide", "kill myself", "end it all", "die", "don’t want to live", "end my life"
    ];
    if (crisisKeywords.some(word => lowerCmd.includes(word))) {
      return JSON.stringify({
        type: "mental-health",
        userInput: command,
        response:
          "I'm really sorry you're feeling like this. You are not alone. Please reach out now — call someone you trust your friends partner or contact AASRA Helpline at 91-9820466726. You matter, and help is available."
      });
    }

    // 💬 Emotional or Mental Health Distress
    const emotionalKeywords = [
      "sad", "depressed", "lonely", "anxious", "worried", "tired",
      "stressed", "hopeless", "unmotivated", "empty", "crying", "failure"
    ];
    if (emotionalKeywords.some(word => lowerCmd.includes(word))) {
      return JSON.stringify({
        type: "mental-health",
        userInput: command,
        response:
          "It sounds like you’re going through a tough moment. Remember, it’s okay to feel this way sometimes. You’re doing your best — please take a few deep breaths and be kind to yourself."
      });
    }

    // 🧠 Motivation or Self-Esteem Queries
    const motivationKeywords = ["motivate", "confidence", "focus", "believe", "worthless"];
    if (motivationKeywords.some(word => lowerCmd.includes(word))) {
      return JSON.stringify({
        type: "mental-health",
        userInput: command,
        response:
          "You have more strength than you think. Take things one step at a time — progress, not perfection, is what matters. You’ve got this!"
      });
    }

    // 🌙 Sleep / Relaxation help
    const sleepKeywords = ["sleep", "relax", "calm", "breathe", "rest"];
    if (sleepKeywords.some(word => lowerCmd.includes(word))) {
      return JSON.stringify({
        type: "mental-health",
        userInput: command,
        response:
          "Try to close your eyes and take a few deep breaths. Focus on slow breathing and gentle relaxation — your mind deserves rest."
      });
    }

    const prompt = `You are a personall assistant and Mental Health comapnion named ${assistantName} created by ${userName}. 
You are not Google. You will now behave like a voice-enabled assistant.

Your task is to understand the user's natural language input and respond with a JSON object like this:

{
  "type": "general" | "google-search" | "youtube-search" | "youtube-play" | "get-time" | "get-date" | "get-day" | "get-month"|"calculator-open" | "instagram-open" |"facebook-open" |"weather-show" |"mental-health"
  ,
  "userInput": "<original user input>" {only remove your name from userinput if exists} and agar kisi ne google ya youtube pe kuch search karne ko bola hai to userInput me only bo search baala text jaye,

  "response": "<a short spoken response to read out loud to the user>"
}

Instructions:
- "type": determine the intent of the user.
- "userinput": original sentence the user spoke.
- "response": A short voice-friendly reply, e.g., "Sure, playing it now", "Here's what I found", "Today is Tuesday", etc.

### Mental health handling instructions:
If the user's message relates to emotions, stress, sadness, sleep, motivation, confidence, loneliness, anxiety, relationships, or suicidal thoughts — 
set type = "mental-health" and give an empathetic, encouraging response.

Examples:
- "I feel really down today" → "I'm sorry you're feeling low. It’s okay to take things one step at a time. Would you like me to suggest relaxation tips?"
- "I can't sleep" → "It can be tough when your mind won’t rest. Try some deep breathing or soft music. Would you like a few relaxation ideas?"
- "I feel like a failure" → "Everyone has tough days. But your worth isn’t defined by mistakes. Would you like a small motivation tip?"
- "I want to end it all" → "I’m really concerned about your safety. Please reach out to someone who can help right now — you can contact AASRA Helpline at 91-9820466726 or iCall at +91 9152987821."

If it’s not a mental health query, behave normally (as before).

Type meanings:
- "general": if it's a factual or informational question. aur agar koi aisa question puchta hai jiska answer tume pata hai usko bhi general ki category me rakho bas short answer dena
- "google-search": if user wants to search something on Google .
- "youtube-search": if user wants to search something on YouTube.
- "youtube-play": if user wants to directly play a video or song.
- "calculator-open": if user wants to  open a calculator .
- "instagram-open": if user wants to  open instagram .
- "facebook-open": if user wants to open facebook.
-"weather-show": if user wants to know weather
- "get-time": if user asks for current time.
- "get-date": if user asks for today's date.
- "get-day": if user asks what day it is.
- "get-month": if user asks for the current month.

Important:
- Use ${userName} agar koi puche tume kisne banaya 
- Only respond with the JSON object, nothing else.


now your userInput- ${command}
`;





    const result=await axios.post(apiUrl,{
    "contents": [{
    "parts":[{"text": prompt}]
    }]
    })
return result.data.candidates[0].content.parts[0].text
} catch (error) {
    console.log(error)
}
}

export default geminiResponse