import { openai } from "@ai-sdk/openai";

const MODEL = "gpt-4.1-mini";

export function getAiModel() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  return openai(MODEL);
}
