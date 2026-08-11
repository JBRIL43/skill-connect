import { NextResponse } from "next/server";
import { z } from "zod";

import { gradeSubmission } from "@/lib/ai/grade";
import { currentProfile } from "@/lib/current-profile";
import { repo } from "@/lib/data";
import { runNotificationCheck } from "@/lib/matcher/notify";
import { MIN_SUBMISSION_CHARS } from "@/lib/sandbox/nodes";
import { resolveNode } from "@/lib/sandbox/resolve";

const bodySchema = z.object({
  nodeId: z.string().min(1),
  // A candidate who never opens the assistant panel still submits, so mode and
  // transcript carry defaults rather than making the caller send empties.
  mode: z.enum(["standard", "pressure_simulation"]).default("standard"),
  submission: z.string().min(MIN_SUBMISSION_CHARS).max(8000),
  transcript: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1).max(4000),
      }),
    )
    .max(40)
    .default([]),
});

export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const field = issue?.path.join(".") || "body";
    return NextResponse.json(
      {
        error:
          field === "submission"
            ? `Your answer must be at least ${MIN_SUBMISSION_CHARS} characters and address the brief.`
            : `Invalid ${field}: ${issue?.message ?? "unexpected value"}`,
      },
      { status: 400 },
    );
  }

  const node = await resolveNode(parsed.data.nodeId);
  if (!node) {
    return NextResponse.json({ error: "Unknown challenge" }, { status: 404 });
  }

  const profile = await currentProfile();
  if (!profile || profile.role !== "job_seeker") {
    return NextResponse.json(
      { error: "Sign in as a job seeker to submit a challenge." },
      { status: 403 },
    );
  }

  const result = await gradeSubmission({
    node,
    submission: parsed.data.submission,
    transcript: parsed.data.transcript,
    mode: parsed.data.mode,
  });

  await repo().saveSandboxScore({
    user_id: profile.id,
    node_id: node.id,
    scores_json: result.scores,
    mode: parsed.data.mode,
  });

  const badge = await repo().awardBadge({
    user_id: profile.id,
    node_id: node.id,
    badge_name: node.badgeName,
  });

  const notifications = await notifyAfterGrade(request, profile.id);

  return NextResponse.json({
    overall: result.overall,
    lines: result.lines,
    summary: result.summary,
    source: result.source,
    badge: { badge_name: badge.badge_name },
    notified: notifications.notified,
    optedOut: notifications.optedOut,
  });
}

/**
 * Dev 1 owns the notification check (Phase 5) and their /api/notifications/check
 * is the route that should ship. It is not wired up by default yet, because
 * adopting it breaks the Pillar 3 demo beat. Set NOTIFY_VIA_DEV1_ROUTE=1 to use
 * it; the check below is one line to delete once the semantics are settled.
 *
 * Measured on the live project. Their route scores a candidate on their *latest*
 * value per competency; the match engine uses their *best*. Meron's seeded row
 * has ai_prompt_literacy 82 and customer_comms 88, which clears Retail Inventory
 * Assistant. Grade her again and the stub returns 48 and 58, so under "latest"
 * she drops below a bar she had already cleared and no notification fires — while
 * the match engine still ranks her at 84 and lists her to the SME. The ranked
 * list and the notifications then disagree about the same candidate.
 *
 * Best is the defensible rule: attempting a challenge again should never cost a
 * candidate standing they earned, or the Sandbox punishes practice. Handed to
 * Dev 1 with this case; theirs to change, since it is their route.
 *
 * Mock mode keeps the stand-in regardless — their route needs a Supabase
 * session, and mock is the fallback that still has to fire the beat on stage.
 */
async function notifyAfterGrade(
  request: Request,
  candidateId: string,
): Promise<{ notified: number; optedOut: boolean }> {
  if (repo().kind === "supabase" && process.env.NOTIFY_VIA_DEV1_ROUTE === "1") {
    try {
      const response = await fetch(
        new URL("/api/notifications/check", request.url),
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            // Their route resolves the caller from the session, so the cookie
            // has to travel with the request.
            cookie: request.headers.get("cookie") ?? "",
          },
          body: JSON.stringify({ candidate_id: candidateId }),
        },
      );

      if (response.ok) {
        const body = (await response.json()) as {
          notified?: number;
          skipped?: string;
        };
        return {
          notified: body.notified ?? 0,
          optedOut: body.skipped === "not_discoverable",
        };
      }

      console.error(
        `[grade] notifications/check returned ${response.status}; using the stand-in`,
      );
    } catch (error) {
      console.error("[grade] notifications/check failed; using the stand-in", error);
    }
  }

  const result = await runNotificationCheck(candidateId);
  return { notified: result.created.length, optedOut: result.skippedOptOut };
}
