import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { ContinuityBrief, SmePosting } from "@/lib/types/database";

import { verifyHandoverToken } from "./handover-token";

export async function getOwnedTransitionPosting(
  smeId: string,
  postingId: string,
): Promise<SmePosting | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("sme_postings")
    .select("*")
    .eq("id", postingId)
    .eq("sme_id", smeId)
    .eq("is_transition_role", true)
    .maybeSingle();

  return (data as SmePosting | null) ?? null;
}

export async function listOwnedTransitionPostings(
  smeId: string,
): Promise<SmePosting[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("sme_postings")
    .select("*")
    .eq("sme_id", smeId)
    .eq("is_transition_role", true)
    .order("created_at", { ascending: false });

  return (data as SmePosting[] | null) ?? [];
}

export async function assertTokenForTransitionPosting(
  postingId: string,
  token: string,
): Promise<{ ok: true; posting: SmePosting } | { ok: false; error: string }> {
  const verified = verifyHandoverToken(token, postingId);
  if (!verified.ok) {
    return verified;
  }

  const admin = createAdminClient();
  const { data } = await admin
    .from("sme_postings")
    .select("*")
    .eq("id", postingId)
    .eq("is_transition_role", true)
    .maybeSingle();

  if (!data) {
    return {
      ok: false,
      error: "This invitation is not linked to an open transition role",
    };
  }

  return { ok: true, posting: data as SmePosting };
}

export async function getReviewedBriefForPosting(
  postingId: string,
): Promise<Pick<ContinuityBrief, "id" | "generated_brief" | "reviewed_by_employee"> | null> {
  const admin = createAdminClient();
  // Employee completion check — never return raw_interview_json to callers.
  const { data } = await admin
    .from("continuity_briefs")
    .select("id, generated_brief, reviewed_by_employee")
    .eq("posting_id", postingId)
    .eq("reviewed_by_employee", true)
    .maybeSingle();

  return data;
}
