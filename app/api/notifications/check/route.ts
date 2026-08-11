import { NextResponse } from "next/server";

import { premiumSmeIds, templatesWithinPlan } from "@/lib/payments/premium";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type {
  RoleSkillTemplate,
  SandboxScore,
  ScoresJson,
} from "@/lib/types/database";

/**
 * POST /api/notifications/check   { "candidate_id": "<uuid>" }
 *
 * Call this right after a challenge is graded. It re-reads the candidate's
 * scores, compares them against every Role Skill Template that asked to be
 * notified, and files a notification for each template they now clear.
 *
 * An API route rather than a Postgres trigger, per Section 7: the matching rule
 * is product logic that will change during the build, and a trigger would make
 * every score write depend on it.
 *
 * Returns { notified, matched, skipped? } — `notified` counts only rows that
 * did not already exist, so calling it twice is a no-op the second time.
 */

type CheckResult = {
  notified: number;
  matched: { template_id: string; sme_id: string; role_name: string }[];
  skipped?: string;
};

/**
 * A candidate accumulates one sandbox_scores row per completed challenge, and
 * the same competency can appear in several. Their standing on a competency is
 * their most recent score for it, not their best — a template bar should
 * reflect where they are now.
 */
function latestScorePerCompetency(rows: Pick<SandboxScore, "scores_json">[]) {
  const latest: ScoresJson = {};

  // rows arrive newest first, so the first value seen for a key wins.
  for (const row of rows) {
    for (const [competency, score] of Object.entries(row.scores_json ?? {})) {
      if (typeof score === "number" && !(competency in latest)) {
        latest[competency] = score;
      }
    }
  }

  return latest;
}

function clears(scores: ScoresJson, template: RoleSkillTemplate) {
  const thresholds = Object.entries(template.thresholds_json ?? {});

  // A template with no bar set would otherwise match every candidate alive and
  // bury the SME in notifications on their first save.
  if (thresholds.length === 0) return false;

  return thresholds.every(([competency, bar]) => {
    const score = scores[competency];
    return typeof score === "number" && score >= bar;
  });
}

export async function POST(request: Request) {
  // Runs as the service role below because it reads across users, so the caller
  // has to be checked here rather than left to RLS.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  let body: { candidate_id?: unknown } = {};
  try {
    body = await request.json();
  } catch {
    // An empty body means "check me", which is the common case from the sandbox.
  }

  const candidateId =
    typeof body.candidate_id === "string" && body.candidate_id
      ? body.candidate_id
      : user.id;

  const admin = createAdminClient();

  if (candidateId !== user.id) {
    const { data: caller } = await admin
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (caller?.role !== "admin") {
      return NextResponse.json(
        { error: "You can only run the check for yourself." },
        { status: 403 },
      );
    }
  }

  const { data: candidate, error: candidateError } = await admin
    .from("profiles")
    .select("id, role, opt_in_discoverable")
    .eq("id", candidateId)
    .maybeSingle();

  if (candidateError) {
    return NextResponse.json({ error: candidateError.message }, { status: 500 });
  }

  if (!candidate) {
    return NextResponse.json({ error: "No such candidate." }, { status: 404 });
  }

  const empty: CheckResult = { notified: 0, matched: [] };

  if (candidate.role !== "job_seeker") {
    return NextResponse.json({ ...empty, skipped: "not_a_job_seeker" });
  }

  // Section 9: scores only count toward a company's search once the candidate
  // has opted in. This is the gate that enforces it.
  if (!candidate.opt_in_discoverable) {
    return NextResponse.json({ ...empty, skipped: "not_discoverable" });
  }

  const [{ data: scoreRows, error: scoresError }, { data: templates, error: templatesError }] =
    await Promise.all([
      admin
        .from("sandbox_scores")
        .select("scores_json")
        .eq("user_id", candidateId)
        .order("completed_at", { ascending: false }),
      admin
        .from("role_skill_templates")
        .select("id, sme_id, role_name, thresholds_json, notify_on_match, created_at")
        .eq("notify_on_match", true),
    ]);

  if (scoresError || templatesError) {
    return NextResponse.json(
      { error: (scoresError ?? templatesError)!.message },
      { status: 500 },
    );
  }

  const scores = latestScorePerCompetency(scoreRows ?? []);

  // Section 6 sells auto-notify as the premium add-on, and this is where
  // notify_on_match actually does anything -- so this is where the plan is
  // enforced. Doing it here rather than in the template editor means the gate
  // holds even if a screen that has not heard of premium lets the flag be set.
  const all = (templates ?? []) as RoleSkillTemplate[];
  const entitled = templatesWithinPlan(
    all,
    await premiumSmeIds(all.map((template) => template.sme_id)),
  );

  const cleared = entitled.filter((template) => clears(scores, template));

  if (cleared.length === 0) {
    return NextResponse.json(empty);
  }

  // unique (sme_id, template_id, candidate_id) makes the database the
  // deduplicator, so there is no read-then-write race between two challenges
  // finishing at once. ignoreDuplicates means the returned rows are exactly the
  // notifications that are new.
  const { data: inserted, error: insertError } = await admin
    .from("notifications")
    .upsert(
      cleared.map((template) => ({
        sme_id: template.sme_id,
        template_id: template.id,
        candidate_id: candidateId,
      })),
      { onConflict: "sme_id,template_id,candidate_id", ignoreDuplicates: true },
    )
    .select("template_id");

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  const newTemplateIds = new Set((inserted ?? []).map((row) => row.template_id));

  return NextResponse.json({
    notified: newTemplateIds.size,
    matched: cleared.map((template) => ({
      template_id: template.id,
      sme_id: template.sme_id,
      role_name: template.role_name,
    })),
  } satisfies CheckResult);
}
