"use server";

import { revalidatePath } from "next/cache";

import { requireCurrentProfile } from "@/lib/current-profile";
import { repo } from "@/lib/data";

/**
 * Marks all unseen notifications for the current SME as seen.
 * Called when the bell is clicked directly (without navigating to the list).
 */
export async function markAllNotificationsSeenAction(): Promise<void> {
  const profile = await requireCurrentProfile();
  if (profile.role !== "sme") return;

  const notifications = await repo().listNotifications(profile.id);
  const unseen = notifications.filter((n) => !n.seen);

  await Promise.all(unseen.map((n) => repo().markNotificationSeen(n.id)));

  revalidatePath("/matcher");
  revalidatePath("/matcher/notifications");
}
