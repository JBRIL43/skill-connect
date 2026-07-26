"use server";

import { revalidatePath } from "next/cache";

import { currentProfile } from "@/lib/current-profile";
import { repo } from "@/lib/data";
import { composeBrief } from "@/lib/handover/compose";
import {
  INTERVIEW_QUESTIONS,
  interviewGaps,
  toRawInterview,
  type InterviewAnswers,
} from "@/lib/handover/interview";

/**
 * Same ownership check the matcher actions use. Section 9 has the outgoing
 * employee possibly holding no account, which would need a signed link; that is
 * more auth surface than a 48-hour build should invent, so the SME opens this
 * and hands over the screen. Strictly tighter than a link anyone could guess.
 */
async function requireOwnedPosting(postingId: string) {
  const profile = await currentProfile();
  if (!profile || profile.role !== "sme") return null;

  const posting = await repo().getPosting(postingId);
  if (!posting || posting.sme_id !== profile.id) return null;

  return { profile, posting };
}

export type InterviewState = {
  error?: string;
  gaps?: string[];
  saved?: boolean;
};

export async function saveInterviewAction(
  _prev: InterviewState,
  formData: FormData,
): Promise<InterviewState> {
  const postingId = String(formData.get("posting_id") ?? "");

  const owned = await requireOwnedPosting(postingId);
  if (!owned) {
    return { error: "You can only record a handover for your own posting." };
  }

  const answers: InterviewAnswers = {};
  for (const question of INTERVIEW_QUESTIONS) {
    answers[question.id] = String(formData.get(question.id) ?? "");
  }

  const interview = toRawInterview(answers);
  const gaps = interviewGaps(interview);
  if (gaps.length) return { gaps };

  try {
    const generated = await composeBrief(interview, owned.posting);
    await repo().saveBriefDraft({
      posting_id: postingId,
      raw_interview_json: interview,
      generated_brief: generated,
    });

    revalidatePath(`/handover/${postingId}`);
    return { saved: true };
  } catch (error) {
    console.error("[handover] saving the interview failed", error);
    return { error: "Could not save the interview. Try again." };
  }
}

export type ReviewState = { error?: string; approved?: boolean };

/**
 * The redaction gate. Nothing else in the app may set this flag: it is what
 * makes the brief readable, what makes the challenge generatable, and the only
 * evidence that a person actually looked at the text before it went out.
 */
export async function approveBriefAction(
  _prev: ReviewState,
  formData: FormData,
): Promise<ReviewState> {
  const postingId = String(formData.get("posting_id") ?? "");
  const edited = String(formData.get("generated_brief") ?? "").trim();

  const owned = await requireOwnedPosting(postingId);
  if (!owned) {
    return { error: "You can only approve a handover for your own posting." };
  }

  if (!edited) {
    return { error: "The brief cannot be empty. Edit it, or start over." };
  }

  const status = await repo().getBriefStatus(postingId);
  if (!status.exists) {
    return { error: "Record the interview before approving a brief." };
  }

  try {
    await repo().setBriefReviewed(postingId, true, edited);
    revalidatePath(`/handover/${postingId}`);
    revalidatePath(`/matcher/postings/${postingId}`);
    return { approved: true };
  } catch (error) {
    console.error("[handover] approving the brief failed", error);
    return { error: "Could not approve the brief. Try again." };
  }
}

/** Puts an approved brief back behind the gate so it can be edited again. */
export async function reopenBriefAction(
  _prev: ReviewState,
  formData: FormData,
): Promise<ReviewState> {
  const postingId = String(formData.get("posting_id") ?? "");

  const owned = await requireOwnedPosting(postingId);
  if (!owned) {
    return { error: "You can only reopen a handover for your own posting." };
  }

  try {
    await repo().setBriefReviewed(postingId, false);
    revalidatePath(`/handover/${postingId}`);
    revalidatePath(`/matcher/postings/${postingId}`);
    return { approved: false };
  } catch (error) {
    console.error("[handover] reopening the brief failed", error);
    return { error: "Could not reopen the brief. Try again." };
  }
}
