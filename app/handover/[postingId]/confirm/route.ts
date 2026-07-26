import { z } from "zod";

import {
  RAW_INTERVIEW_JSON_VERSION,
  rawInterviewJsonSchema,
} from "@/lib/ai/handover";
import {
  assertTokenForTransitionPosting,
  getReviewedBriefForPosting,
} from "@/lib/ai/handover-access";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const requestSchema = z.object({
  token: z.string().min(10),
  generated_brief: z.string().trim().min(40).max(12_000),
  raw_interview_json: rawInterviewJsonSchema,
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

  if (parsed.data.raw_interview_json.version !== RAW_INTERVIEW_JSON_VERSION) {
    return Response.json(
      { error: "Unsupported interview transcript version" },
      { status: 400 },
    );
  }

  const existing = await getReviewedBriefForPosting(postingId);
  if (existing) {
    return Response.json({
      id: existing.id,
      reviewed_by_employee: true,
      already_confirmed: true,
    });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("continuity_briefs")
    .insert({
      posting_id: postingId,
      raw_interview_json: parsed.data.raw_interview_json,
      generated_brief: parsed.data.generated_brief,
      reviewed_by_employee: true,
    })
    .select("id, reviewed_by_employee")
    .single();

  if (error || !data) {
    // A concurrent confirm may have won the race — return the reviewed row.
    const raced = await getReviewedBriefForPosting(postingId);
    if (raced) {
      return Response.json({
        id: raced.id,
        reviewed_by_employee: true,
        already_confirmed: true,
      });
    }

    return Response.json(
      { error: error?.message ?? "Failed to save Continuity Brief" },
      { status: 500 },
    );
  }

  return Response.json({
    id: data.id,
    reviewed_by_employee: data.reviewed_by_employee,
    already_confirmed: false,
  });
}
