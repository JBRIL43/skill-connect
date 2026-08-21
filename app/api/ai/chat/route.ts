import { createTextStreamResponse, toTextStream } from "ai";

import {
  conversationRequestSchema,
  streamConversation,
} from "@/lib/ai";
import { hasLiveAiKey } from "@/lib/ai/model";
import { stubReplyStream } from "@/lib/ai/stub-coach";
import { getSessionProfile } from "@/lib/auth";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  const profile = await getSessionProfile();
  if (!profile) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = conversationRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Invalid request", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  // No key, no model: answer from the deterministic coach rather than 503ing
  // the whole of Pillar 1. Plain text either way, so the client cannot tell the
  // difference at the transport level.
  if (!hasLiveAiKey()) {
    return new Response(stubReplyStream(parsed.data.mode, parsed.data.messages), {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Conversation-Mode": parsed.data.mode,
        "X-Conversation-Source": "stub",
      },
    });
  }

  try {
    const result = streamConversation(parsed.data);
    return createTextStreamResponse({
      status: 200,
      headers: {
        "Cache-Control": "no-store",
        "X-Conversation-Mode": parsed.data.mode,
      },
      stream: toTextStream({ stream: result.stream }),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to stream response";
    const status =
      message.includes("API key") ||
      message.includes("OPENAI_API_KEY") ||
      message.includes("GEMINI_API_KEY")
        ? 503
        : 500;
    return Response.json({ error: message }, { status });
  }
}
