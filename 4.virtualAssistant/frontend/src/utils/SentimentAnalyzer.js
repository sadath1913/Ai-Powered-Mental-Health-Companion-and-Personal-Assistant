import Sentiment from "sentiment";

const sentiment = new Sentiment();

/**
 * Analyze text sentiment and return "positive" | "neutral" | "negative"
 */
export const analyzeTextSentiment = (text) => {
  const result = sentiment.analyze(text);
  if (result.score > 1) return "positive";
  if (result.score < 0) return "negative";
  return "neutral";
};
