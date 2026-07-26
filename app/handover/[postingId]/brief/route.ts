import { z } from "zod";

import {
  RAW_INTERVIEW_JSON_VERSION,
  rawInterviewJsonSchema,
} from "@/lib/ai/handover";
import { generateContinuityBriefDraft } from "@/lib/ai/handover-engine";
import { assertTokenForTransitionPosting } from "@/lib/ai/handover-access";
import { conversationMessageSchema } from "@/lib/ai/schemas";

export const runtime = "nodejs";
export const maxDuration = 60;

const requestSchema = z.object({
  token: z.string().min(10),
  locale: z.enum(["en", "am"]),
  messages: z.array(conversationMessageSchema).min(4).max(40),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ postingId: string }> },
) {
  const { postingId } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Invalid request", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const access = await assertTokenForTransitionPosting(
    postingId,
    parsed.data.token,
  );
  if (!access.ok) {
    return Response.json({ error: access.error }, { status: 401 });
  }

  const interview = rawInterviewJsonSchema.safeParse({
    version: RAW_INTERVIEW_JSON_VERSION,
    locale: parsed.data.locale,
    completed_at: new Date().toISOString(),
    messages: parsed.data.messages,
  });

  if (!interview.success) {
    return Response.json(
      { error: "Interview transcript is incomplete" },
      { status: 400 },
    );
  }

  try {
    const { markdown } = await generateContinuityBriefDraft(interview.data);
    return Response.json(
      {
        generated_brief: markdown,
        raw_interview_json: interview.data,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to generate brief";
    const status = message.includes("OPENAI_API_KEY") ? 503 : 500;
    return Response.json({ error: message }, { status });
  }
}
