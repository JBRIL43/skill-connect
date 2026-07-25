import { z } from "zod";

import { conversationMessageSchema } from "./schemas";

/**
 * Frozen Dev 3 contract for continuity_briefs.raw_interview_json.
 *
 * Dev 3 custom-challenge generation must read only rows where
 * reviewed_by_employee = true, and must treat this shape as the input.
 * Do not rename fields without coordinating with Dev 3.
 */
export const RAW_INTERVIEW_JSON_VERSION = 1 as const;

export const rawInterviewJsonSchema = z.object({
  version: z.literal(RAW_INTERVIEW_JSON_VERSION),
  locale: z.enum(["en", "am"]),
  completed_at: z.string().datetime(),
  messages: z.array(conversationMessageSchema).min(4).max(40),
});

export type RawInterviewJson = z.infer<typeof rawInterviewJsonSchema>;
