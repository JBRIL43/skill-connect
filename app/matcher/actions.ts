"use server";

import { revalidatePath } from "next/cache";

import { generateTransitionChallenge } from "@/lib/ai/challenge-gen";
import { currentProfile } from "@/lib/current-profile";
import { repo } from "@/lib/data";
import type { MatchStatus } from "@/lib/data/types";
import { runMatch } from "@/lib/matcher/run";

export type RunMatchState = {
  error?: string;
  considered?: number;
  matched?: number;
};

/** Verifies the caller owns the posting before anything privileged runs. */
async function requireOwnedPosting(postingId: string) {
  const profile = await currentProfile();
  if (!profile || profile.role !== "sme") return null;

  const posting = await repo().getPosting(postingId);
  if (!posting || posting.sme_id !== profile.id) return null;

  return { profile, posting };
}

export async function runMatchAction(
  _prev: RunMatchState,
  formData: FormData,
): Promise<RunMatchState> {
  const postingId = String(formData.get("posting_id") ?? "");

  const owned = await requireOwnedPosting(postingId);
  if (!owned) {
    return { error: "You can only run matching on your own posting." };
  }

  try {
    const result = await runMatch(postingId);
    revalidatePath(`/matcher/postings/${postingId}`);
    return { considered: result.considered, matched: result.matched };
  } catch (error) {
    console.error("[matcher] match run failed", error);
    return {
      error:
        error instanceof Error
          ? error.message
          : "The match run failed. Try again.",
    };
  }
}

export type SetStatusState = { error?: string };

export async function setMatchStatusAction(
  _prev: SetStatusState,
  formData: FormData,
): Promise<SetStatusState> {
  const matchId = String(formData.get("match_id") ?? "");
  const postingId = String(formData.get("posting_id") ?? "");
  const status = String(formData.get("status") ?? "") as MatchStatus;

  if (!["suggested", "shortlisted", "hired"].includes(status)) {
    return { error: "Unknown status." };
  }

  const owned = await requireOwnedPosting(postingId);
  if (!owned) {
    return { error: "You can only change matches on your own posting." };
  }

  const matches = await repo().listMatchesForPosting(postingId);
  if (!matches.some((row) => row.id === matchId)) {
    return { error: "That match is not on this posting." };
  }

  await repo().setMatchStatus(matchId, status);

  revalidatePath(`/matcher/postings/${postingId}`);
  // A hire changes the public company page's track record.
  revalidatePath("/company-profile");

  return {};
}

export type HandoverState = {
  error?: string;
  nodeId?: string;
  title?: string;
  regenerated?: boolean;
};

/**
 * Pillar 3b: turns a departing employee's reviewed handover into a scored
 * challenge, so the replacement is measured on the actual job rather than a
 * generic rubric. The candidate side needs no new code — the generated node
 * uses the Pillar 2 shape, so grading, badges, and matching all already work.
 */
export async function generateHandoverChallengeAction(
  _prev: HandoverState,
  formData: FormData,
): Promise<HandoverState> {
  const postingId = String(formData.get("posting_id") ?? "");

  const owned = await requireOwnedPosting(postingId);
  if (!owned) {
    return { error: "You can only build a challenge for your own posting." };
  }

  const brief = await repo().getBriefByPosting(postingId);
  if (!brief) {
    return {
      error:
        "No handover interview exists for this role yet. The departing employee completes that first.",
    };
  }

  // Section 9, point 4: an unreviewed brief is unredacted, so it never becomes
  // a challenge candidates can read.
  if (!brief.reviewed_by_employee) {
    return {
      error:
        "The departing employee has not approved this brief yet, so it cannot be published as a challenge.",
    };
  }

  const template = owned.posting.template_id
    ? await repo().getTemplate(owned.posting.template_id)
    : null;

  try {
    const node = await generateTransitionChallenge({
      posting: owned.posting,
      brief,
      thresholds: template?.thresholds_json,
    });

    await repo().saveGeneratedChallenge({
      node_id: node.id,
      posting_id: postingId,
      payload: node,
    });

    // continuity_briefs has no write policy at all, so this write goes through
    // the service role inside the adapter.
    await repo().setBriefCustomNode(brief.id, node.id);

    revalidatePath(`/matcher/postings/${postingId}`);
    // The challenge now appears in every candidate's node tree.
    revalidatePath("/sandbox");

    return {
      nodeId: node.id,
      title: node.title,
      regenerated: Boolean(brief.custom_node_id),
    };
  } catch (error) {
    console.error("[matcher] handover challenge generation failed", error);
    return {
      error:
        error instanceof Error
          ? error.message
          : "Could not build the challenge. Try again.",
    };
  }
}
