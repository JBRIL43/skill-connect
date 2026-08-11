"use server";

import { requireRole } from "@/lib/auth";
import {
  createHandoverToken,
  handoverInvitePath,
} from "@/lib/ai/handover-token";
import { getOwnedTransitionPosting } from "@/lib/ai/handover-access";

export async function createHandoverInviteLink(postingId: string) {
  const profile = await requireRole("sme");

  if (!postingId || typeof postingId !== "string") {
    return { error: "Missing posting id" };
  }

  const posting = await getOwnedTransitionPosting(profile.id, postingId);
  if (!posting) {
    return {
      error: "Only your own transition-role postings can create invite links",
    };
  }

  try {
    const token = createHandoverToken(posting.id);
    const path = handoverInvitePath(posting.id, token);
    return { path, expiresInHours: 72 };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Unable to create invitation link",
    };
  }
}
