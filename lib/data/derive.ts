import type { SandboxScore, ScoreMap } from "@/lib/data/types";
import {
  COMPETENCY_KEYS,
  type CompetencyKey,
} from "@/lib/sandbox/competencies";

/**
 * A candidate's standing score per competency: their best result across every
 * challenge they have completed. Thresholds are compared against this, not
 * against a single challenge, so improving on a later node counts.
 */
export function bestScores(scores: SandboxScore[]): ScoreMap {
  const best: ScoreMap = {};

  for (const row of scores) {
    for (const key of COMPETENCY_KEYS) {
      const value = row.scores_json[key];
      if (typeof value !== "number") continue;
      const current = best[key];
      if (current === undefined || value > current) best[key] = value;
    }
  }

  return best;
}

/** Weighted overall for a single graded submission (rubric weights sum to 1). */
export function weightedOverall(
  scores: ScoreMap,
  weights: { competency: CompetencyKey; weight: number }[],
): number {
  let total = 0;
  let weightUsed = 0;

  for (const { competency, weight } of weights) {
    const value = scores[competency];
    if (typeof value !== "number") continue;
    total += value * weight;
    weightUsed += weight;
  }

  if (weightUsed === 0) return 0;
  return Math.round(total / weightUsed);
}

export function averageScore(scores: ScoreMap): number {
  const values = Object.values(scores).filter(
    (value): value is number => typeof value === "number",
  );
  if (values.length === 0) return 0;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

export function groupScoresByUser(
  scores: SandboxScore[],
): Map<string, SandboxScore[]> {
  const grouped = new Map<string, SandboxScore[]>();
  for (const row of scores) {
    const existing = grouped.get(row.user_id);
    if (existing) existing.push(row);
    else grouped.set(row.user_id, [row]);
  }
  return grouped;
}
