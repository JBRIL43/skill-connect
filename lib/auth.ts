import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { createClient } from "./supabase/server";
import type { Profile, UserRole } from "./types/database";

/** Where each role lands after login (Section 4). */
export function homePathForRole(role: UserRole) {
  return role === "admin" ? "/admin" : "/dashboard";
}

/**
 * Mock mode has no Supabase project to authenticate against, so every page
 * behind this helper — the dashboard, the coach, the chatbot — redirects to a
 * login that cannot succeed. That turns the offline fallback into a fallback
 * that only covers Pillars 2 and 3, which is not much of a fallback.
 *
 * A fixture profile stands in, chosen by the same cookie /demo already sets.
 * Not a second auth system: it needs the literal string "mock", so in any
 * configuration that can reach real data this never runs.
 */
async function mockProfile(): Promise<Profile | null> {
  const { DEMO_PROFILE_COOKIE } = await import("./current-profile");
  const { repo } = await import("./data");

  const selected = (await cookies()).get(DEMO_PROFILE_COOKIE)?.value;
  const profile =
    (selected ? await repo().getProfile(selected) : null) ??
    (await repo().getProfile("js-selam"));

  return (profile as Profile | null) ?? null;
}

export async function getSessionProfile(): Promise<Profile | null> {
  if (process.env.NEXT_PUBLIC_DATA_SOURCE === "mock") return mockProfile();

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  return (data as Profile | null) ?? null;
}

export async function requireProfile(): Promise<Profile> {
  const profile = await getSessionProfile();
  if (!profile) redirect("/login");
  return profile;
}

/**
 * Server-side role gate. The admin console checks this rather than relying on a
 * hidden nav link, so a guessed URL cannot reach it.
 */
export async function requireRole(role: UserRole): Promise<Profile> {
  const profile = await requireProfile();
  if (profile.role !== role) redirect(homePathForRole(profile.role));
  return profile;
}
