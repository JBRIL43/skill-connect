"use server";

import { revalidatePath } from "next/cache";

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
