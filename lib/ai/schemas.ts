import { z } from "zod";

export const conversationModeSchema = z.enum([
  "coach",
  "chatbot",
  "handover",
]);

export type ConversationMode = z.infer<typeof conversationModeSchema>;

export const conversationMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().trim().min(1).max(4_000),
});

export type ConversationMessage = z.infer<typeof conversationMessageSchema>;

export const conversationRequestSchema = z.object({
  mode: conversationModeSchema,
  messages: z.array(conversationMessageSchema).min(1).max(30),
});

const score = z.number().int().min(0).max(100);

/**
 * Stable axes for the coach's initial assessment and the Skill Radar.
 * These are self-reported/inferred signals, never verified Sandbox Scores.
 */
export const skillMatrixSchema = z.object({
  technical: z.object({
    digital_literacy: score,
    ai_literacy: score,
    data_handling: score,
    domain_tools: score,
  }),
  human: z.object({
    problem_solving: score,
    adaptability: score,
    communication: score,
    collaboration: score,
    empathy: score,
  }),
  raw_notes: z.string().trim().min(1).max(500),
});

export type SkillMatrixOutput = z.infer<typeof skillMatrixSchema>;

export const skillExtractionRequestSchema = z.object({
  messages: z.array(conversationMessageSchema).min(6).max(30),
});
