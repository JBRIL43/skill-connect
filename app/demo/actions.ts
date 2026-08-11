"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { DEMO_PROFILE_COOKIE } from "@/lib/current-profile";
import { repo } from "@/lib/data";

/**
 * Mock-mode only. With a live database, identity comes from Supabase Auth and
 * this refuses to run — otherwise it would be a way to become another user.
 */
export async function actAsAction(formData: FormData): Promise<void> {
  if (repo().kind !== "mock") redirect("/login");

  const profileId = String(formData.get("profile_id") ?? "");
  const profile = await repo().getProfile(profileId);
  if (!profile) redirect("/demo");

  (await cookies()).set(DEMO_PROFILE_COOKIE, profile.id, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });

  revalidatePath("/", "layout");
  redirect(profile.role === "sme" ? "/matcher" : "/sandbox");
}
