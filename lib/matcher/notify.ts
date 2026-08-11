import { repo } from "@/lib/data";
import { bestScores } from "@/lib/data/derive";
import type { Notification } from "@/lib/data/types";
import { evaluateThresholds } from "@/lib/matcher/score";

export type NotificationCheckResult = {
  templatesChecked: number;
  created: Notification[];
  skippedOptOut: boolean;
};

/**
 * Template-triggered notification check, run right after a challenge is graded.
 *
 * This is Dev 1's Phase 5 responsibility and their /api/notifications/check
 * route replaces it: when that route exists, the grade handler should POST to it
 * instead of calling this function. Implemented here as a stand-in so the
 * Pillar 3 demo beat (a notification firing live on stage) works today.
 *
 * Two rules from Section 9 are enforced here rather than in the UI:
 * - candidates who have not opted in are never evaluated;
 * - one notification per (sme_id, template_id, candidate_id), never a duplicate.
 */
export async function runNotificationCheck(
  candidateId: string,
): Promise<NotificationCheckResult> {
  const candidate = await repo().getProfile(candidateId);

  if (!candidate || !candidate.opt_in_discoverable) {
    return { templatesChecked: 0, created: [], skippedOptOut: true };
  }

  const [templates, scores] = await Promise.all([
    repo().listNotifyTemplates(),
    repo().listSandboxScores(candidateId),
  ]);

  const candidateScores = bestScores(scores);
  const created: Notification[] = [];

  for (const template of templates) {
    const check = evaluateThresholds(candidateScores, template.thresholds_json);
    if (!check.clears) continue;

    const notification = await repo().createNotificationIfNew({
      sme_id: template.sme_id,
      template_id: template.id,
      candidate_id: candidateId,
    });

    if (notification) created.push(notification);
  }

  return {
    templatesChecked: templates.length,
    created,
    skippedOptOut: false,
  };
}
