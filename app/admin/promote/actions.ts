"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export type PromoteState = { error?: string };

/**
 * Hackathon-only shortcut from Section 4. The documented primary path is still
 * flipping a seed user's role by hand in Supabase Studio; this exists so an
 * admin can be minted on-site without opening the dashboard.
 */
export async function promoteAction(
  _prev: PromoteState,
  formData: FormData,
): Promise<PromoteState> {
  const expected = process.env.ADMIN_INVITE_CODE;

  if (!expected) {
    return {
      error: "Promotion is disabled because ADMIN_INVITE_CODE is not set.",
    };
  }

  const code = String(formData.get("code") ?? "").trim();
  if (code !== expected) {
    return { error: "That invite code is not valid." };
  }

  const profile = await requireProfile();

  // Goes through the service role because the profiles RLS policy deliberately
  // refuses to let anyone write role = 'admin' to their own row.
  const admin = createAdminClient();
  const { error } = await admin
    .from("profiles")
    .update({ role: "admin" })
    .eq("id", profile.id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/", "layout");
  redirect("/admin");
}
