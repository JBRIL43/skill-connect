/**
 * Pillar 1's model seam. Implementation lives in provider.ts so Gemini and
 * OpenAI stay one switch for the whole app.
 */
export { aiModel as getAiModel, hasLiveAiKey } from "@/lib/ai/provider";
