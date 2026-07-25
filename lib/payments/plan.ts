import { FREE_NOTIFY_TEMPLATE_LIMIT } from "./config";

/**
 * What a plan entitles you to, as a pure function of the data.
 *
 * Deliberately free of `server-only` and of any database access, so the rule
 * that decides whether an SME gets notified can be tested on its own. Reading
 * who has paid is premium.ts's job; deciding what that buys them is this file's.
 */

export type PlannedTemplate = { sme_id: string; created_at: string };

/**
 * Filters templates down to the ones their owner's plan actually covers.
 *
 * Free accounts keep their oldest, not their newest. The alternative would let a
 * newly added template silently switch off the first one they set up, and an SME
 * who stops getting notifications they had come to rely on will not read that as
 * a pricing decision -- they will read it as the product being broken.
 */
export function templatesWithinPlan<T extends PlannedTemplate>(
  templates: T[],
  premium: Set<string>,
): T[] {
  const used = new Map<string, number>();

  return [...templates]
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .filter((template) => {
      if (premium.has(template.sme_id)) return true;

      const count = used.get(template.sme_id) ?? 0;
      used.set(template.sme_id, count + 1);

      return count < FREE_NOTIFY_TEMPLATE_LIMIT;
    });
}
