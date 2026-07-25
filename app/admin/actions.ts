"use server";

import { revalidatePath } from "next/cache";

import { requireRole } from "@/lib/auth";
import { runSeed } from "@/lib/seed/run";
import { createAdminClient } from "@/lib/supabase/admin";

export type SeedState = { message?: string; error?: string };

/**
 * Both actions run under the service role, so each one re-checks the caller.
 * A server action is a public POST endpoint — the fact that the button only
 * renders on /admin protects nothing.
 */

export async function seedDemoDataAction(
  _prev: SeedState,
  _formData: FormData,
): Promise<SeedState> {
  await requireRole("admin");

  try {
    const summary = await runSeed();
    revalidatePath("/admin");

    const counts = [
      `${summary.jobSeekers} job seekers`,
      `${summary.smes} companies`,
      `${summary.templates} templates`,
      `${summary.postings} postings`,
      `${summary.scores} graded challenges`,
    ].join(", ");

    if (summary.errors.length > 0) {
      return {
        message: `Loaded ${counts}.`,
        error: `${summary.errors.length} persona(s) failed: ${summary.errors.join("; ")}`,
      };
    }

    return { message: `Loaded ${counts}. Pressing again updates the same rows.` };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Seeding failed.",
    };
  }
}

export async function setCompanyVerifiedAction(formData: FormData) {
  await requireRole("admin");

  const smeId = formData.get("sme_id");
  const verified = formData.get("verified") === "true";

  if (typeof smeId !== "string" || !smeId) return;

  const admin = createAdminClient();
  await admin
    .from("company_profiles")
    .update({ verified })
    .eq("sme_id", smeId);

  revalidatePath("/admin");
}
