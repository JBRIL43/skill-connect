import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";

export type AiProviderName = "gemini" | "openai";
export type AiSource = "live" | "stub";

/**
 * Which cloud provider a live call would use. Gemini wins when its key is set
 * so a machine with both keys still prefers the free-tier path the team chose.
 */
export function preferredProvider(): AiProviderName | null {
  if (process.env.GEMINI_API_KEY) return "gemini";
  if (process.env.OPENAI_API_KEY) return "openai";
  return null;
}

function hasAnyAiKey(): boolean {
  return Boolean(process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY);
}

/**
 * Pillar 2 / 3: live only when explicitly opted in. A missing key still falls
 * through to the stub path instead of throwing mid-demo.
 */
export function isLiveAI(): boolean {
  return process.env.AI_MODE === "live" && hasAnyAiKey();
}

/**
 * Pillar 1 coach / chatbot / handover interview: a key alone is enough to go
 * live. AI_MODE=stub forces the deterministic path even when a key exists.
 */
export function hasLiveAiKey(): boolean {
  return hasAnyAiKey() && process.env.AI_MODE !== "stub";
}

export function aiSource(): AiSource {
  return isLiveAI() ? "live" : "stub";
}

/**
 * Shared model factory for every live generateText / streamText / generateObject
 * call. Defaults: gemini-2.5-pro when on Gemini, gpt-4o-mini when on OpenAI —
 * override with AI_MODEL.
 */
export function aiModel() {
  const provider = preferredProvider();
  if (!provider) {
    throw new Error(
      "No AI API key configured. Set GEMINI_API_KEY or OPENAI_API_KEY.",
    );
  }

  if (provider === "gemini") {
    const google = createGoogleGenerativeAI({
      apiKey: process.env.GEMINI_API_KEY,
    });
    return google(process.env.AI_MODEL ?? "gemini-3.1-pro-preview");
  }

  const openai = createOpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
  return openai(process.env.AI_MODEL ?? "gpt-4o-mini");
}

/** Alias used by the Pillar 1 engine — same factory, one place to change. */
export function getAiModel() {
  return aiModel();
}
