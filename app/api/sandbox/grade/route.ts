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
 * Dev 1 owns the notification check (Phase 5) and their route is the one that
 * ships. It authenticates with a Supabase session, though, and mock mode has
 * none — mock is the demo-day fallback and must keep firing the Pillar 3 beat,
 * so the stand-in stays as the mock path rather than being deleted.
 *
 * Their route reads the *latest* score per competency where the match engine
 * reads the *best*. A candidate who retries a challenge and scores lower can
 * therefore be notified against one bar and ranked against another. Flagged to
 * Dev 1; the engine keeps best, because a retry should not cost standing.
 */
async function notifyAfterGrade(
  request: Request,
  candidateId: string,
): Promise<{ notified: number; optedOut: boolean }> {
  if (repo().kind === "supabase") {
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
