import { createTextStreamResponse, toTextStream } from "ai";
import { z } from "zod";

import { assertTokenForTransitionPosting } from "@/lib/ai/handover-access";
import {
  conversationMessageSchema,
  streamConversation,
} from "@/lib/ai";

export const runtime = "nodejs";
export const maxDuration = 60;

const requestSchema = z.object({
  token: z.string().min(10),
  messages: z.array(conversationMessageSchema).min(1).max(30),
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

  try {
    const result = streamConversation({
      mode: "handover",
      messages: parsed.data.messages,
    });

    return createTextStreamResponse({
      status: 200,
      headers: {
        "Cache-Control": "no-store",
        "X-Conversation-Mode": "handover",
      },
      stream: toTextStream({ stream: result.stream }),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to stream response";
    const status = message.includes("OPENAI_API_KEY") ? 503 : 500;
    return Response.json({ error: message }, { status });
  }
}
