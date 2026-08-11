"use server";

import { revalidatePath } from "next/cache";

import { currentProfile } from "@/lib/current-profile";
import { repo } from "@/lib/data";

/**
 * Section 9, point 2: discoverability is the candidate's decision, and it is
 * theirs alone to flip. Server-side only — a client-side check would not be a
 * control at all.
 */
export async function setDiscoverable(value: boolean): Promise<void> {
  const profile = await currentProfile();
  if (!profile || profile.role !== "job_seeker") return;

  await repo().setOptInDiscoverable(profile.id, value);
  revalidatePath("/", "layout");
}
