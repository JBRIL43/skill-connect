import { redirect } from "next/navigation";

import { createClient } from "./supabase/server";
import type { Profile, UserRole } from "./types/database";

/** Where each role lands after login (Section 4). */
export function homePathForRole(role: UserRole) {
  return role === "admin" ? "/admin" : "/dashboard";
}

export async function getSessionProfile(): Promise<Profile | null> {
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
