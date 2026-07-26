import { openai } from "@ai-sdk/openai";

/**
 * AI_MODE=live only counts when a key is actually present. A missing key on the
 * demo machine falls back to the stub path instead of throwing mid-demo.
 */
export function isLiveAI(): boolean {
  return process.env.AI_MODE === "live" && Boolean(process.env.OPENAI_API_KEY);
}

export function aiModel() {
  return openai(process.env.AI_MODEL ?? "gpt-4o-mini");
}

export type AiSource = "live" | "stub";

export function aiSource(): AiSource {
  return isLiveAI() ? "live" : "stub";
}
