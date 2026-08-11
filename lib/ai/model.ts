import { openai } from "@ai-sdk/openai";

const MODEL = "gpt-4.1-mini";

/**
 * Whether Pillar 1 should call a model at all.
 *
 * A key alone is the signal, so nothing has to be configured to go live.
 * AI_MODE=stub forces the deterministic path back on even when a key exists,
 * which is what you want on stage: a rate limit clearing mid-answer is not a
 * risk worth taking in front of judges.
 */
export function hasLiveAiKey(): boolean {
  return Boolean(process.env.OPENAI_API_KEY) && process.env.AI_MODE !== "stub";
}

export function getAiModel() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  return openai(MODEL);
}
