import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { FREE_NOTIFY_TEMPLATE_LIMIT } from "./config";

export { templatesWithinPlan } from "./plan";

/**
 * Premium is derived, never stored.
 *
 * An SME is premium because they own a settled payments row -- there is no
 * profiles.is_premium to fall out of sync with the payment that was supposed to
 * set it, and no way to be premium without a row saying who paid what.
 */
export async function isPremium(smeId: string): Promise<boolean> {
  const admin = createAdminClient();

  const { data } = await admin
    .from("payments")
    .select("id")
    .eq("sme_id", smeId)
    .eq("status", "paid")
    .limit(1);

  return (data?.length ?? 0) > 0;
}

/**
 * The premium subset of a list of SMEs, in one query.
 *
 * The notification check walks every template on the platform, so asking
 * isPremium() per template would be a round trip per row on the hot path of
 * every graded challenge.
 */
export async function premiumSmeIds(smeIds: string[]): Promise<Set<string>> {
  if (smeIds.length === 0) return new Set();

  const admin = createAdminClient();

  const { data } = await admin
    .from("payments")
    .select("sme_id")
    .eq("status", "paid")
    .in("sme_id", [...new Set(smeIds)]);

  return new Set((data ?? []).map((row) => row.sme_id as string));
}

/**
 * Whether this SME may set notify_on_match on one more template.
 *
 * Read the free limit in config.ts before changing it -- it is 1 rather than 0
 * so the demo script still fires its notification at step 5, before the upgrade
 * at step 7.
 */
export async function canEnableNotify(
  smeId: string,
  /** Excluded from the count when editing a template that is already on. */
  excludeTemplateId?: string,
): Promise<boolean> {
  if (await isPremium(smeId)) return true;

  const admin = createAdminClient();
  let query = admin
    .from("role_skill_templates")
    .select("id")
    .eq("sme_id", smeId)
    .eq("notify_on_match", true);

  if (excludeTemplateId) query = query.neq("id", excludeTemplateId);

  const { data } = await query;

  return (data?.length ?? 0) < FREE_NOTIFY_TEMPLATE_LIMIT;
}
