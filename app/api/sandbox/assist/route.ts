import { NextResponse } from "next/server";
import { z } from "zod";

import { assistReply } from "@/lib/ai/assist";
import { resolveNode } from "@/lib/sandbox/resolve";

const bodySchema = z.object({
  nodeId: z.string().min(1),
  mode: z.enum(["standard", "pressure_simulation"]),
  transcript: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1).max(4000),
      }),
    )
    .max(40),
});

export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const node = await resolveNode(parsed.data.nodeId);
  if (!node) {
    return NextResponse.json({ error: "Unknown challenge" }, { status: 404 });
  }

  if (parsed.data.mode === "pressure_simulation" && !node.pressureSimulationAllowed) {
    return NextResponse.json(
      { error: "Pressure simulation is not enabled for this challenge" },
      { status: 400 },
    );
  }

  const { reply, source } = await assistReply({
    node,
    transcript: parsed.data.transcript,
    mode: parsed.data.mode,
  });

  return NextResponse.json({ reply, source });
}
