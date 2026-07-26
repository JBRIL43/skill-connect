import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { getSessionProfile } from "@/lib/auth";
import { repo } from "@/lib/data";
import type { Profile } from "@/lib/data/types";

export const DEMO_PROFILE_COOKIE = "sc_demo_profile";

const DEFAULT_DEMO_PROFILE = "js-selam";

/**
 * Who is acting, in whichever mode the app is running.
 *
 * With NEXT_PUBLIC_DATA_SOURCE=supabase this is exactly Dev 1's auth and nothing
 * else. With mock data there is no Supabase project to authenticate against, so
 * a fixture profile stands in — otherwise mock mode cannot render a single page,
 * which would cost us the one mitigation the risk register has for a dead
 * network or an unapplied migration on demo day.
 *
 * This is deliberately not a second auth system: it cannot grant access to real
 * data, because in supabase mode it never runs.
 */
export async function currentProfile(): Promise<Profile | null> {
  // getSessionProfile resolves the same fixture in mock mode, so the two agree
  // on who is acting whichever helper a page happens to call.
  if (repo().kind === "supabase") return getSessionProfile();

  const selected = (await cookies()).get(DEMO_PROFILE_COOKIE)?.value;

  return (
    (selected ? await repo().getProfile(selected) : null) ??
    (await repo().getProfile(DEFAULT_DEMO_PROFILE))
  );
}

export async function requireCurrentProfile(): Promise<Profile> {
  const profile = await currentProfile();
  if (!profile) redirect("/login");
  return profile;
}
