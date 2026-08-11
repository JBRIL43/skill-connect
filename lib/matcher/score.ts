import type { ScoreMap } from "@/lib/data/types";
import type { CompetencyKey } from "@/lib/sandbox/competencies";

export type ThresholdLine = {
  competency: CompetencyKey;
  required: number;
  actual: number | null;
  clears: boolean;
};

export type ThresholdCheck = {
  clears: boolean;
  met: number;
  total: number;
  lines: ThresholdLine[];
  /** How far the worst shortfall is below its threshold, 0 when clearing. */
  worstShortfall: number;
};

/**
 * The hard gate. Section 2, point 2: a candidate is eligible only if their
 * verified Sandbox Scores clear every threshold on the template. An unattempted
 * competency is a miss, not a pass — silence is not evidence.
 */
export function evaluateThresholds(
  scores: ScoreMap,
  thresholds: ScoreMap,
): ThresholdCheck {
  const keys = Object.keys(thresholds) as CompetencyKey[];

  const lines: ThresholdLine[] = keys.map((competency) => {
    const required = thresholds[competency] ?? 0;
    const actual = scores[competency] ?? null;
    return {
      competency,
      required,
      actual,
      clears: actual !== null && actual >= required,
    };
  });

  const met = lines.filter((line) => line.clears).length;
  const shortfalls = lines
    .filter((line) => !line.clears)
    .map((line) => line.required - (line.actual ?? 0));

  return {
    clears: keys.length > 0 && met === keys.length,
    met,
    total: keys.length,
    lines,
    worstShortfall: shortfalls.length ? Math.max(...shortfalls) : 0,
  };
}

export type MatchScoreInput = {
  check: ThresholdCheck;
  /** 0-1 semantic similarity between the role and the candidate's profile. */
  semantic: number;
  /** Number of graded challenges behind the scores — breadth of evidence. */
  verifiedChallenges: number;
};

/**
 * Match Score, 0-100. Deliberately layered so it degrades safely:
 *
 * - 70 points for clearing every threshold, which is the only hard requirement.
 * - up to 20 for headroom above the thresholds.
 * - up to 10 for semantic fit, which is additive — when embeddings are
 *   unavailable the score still ranks sensibly on verified evidence alone.
 */
export function matchScore({
  check,
  semantic,
  verifiedChallenges,
}: MatchScoreInput): number {
  if (!check.clears) return 0;

  const headroomRatios = check.lines.map((line) => {
    const actual = line.actual ?? 0;
    const required = line.required || 1;
    return Math.min((actual - required) / required, 0.4) / 0.4;
  });

  const headroom = headroomRatios.length
    ? headroomRatios.reduce((sum, value) => sum + value, 0) /
      headroomRatios.length
    : 0;

  const breadth = Math.min(verifiedChallenges, 3) / 3;
  const clamped = Math.max(0, Math.min(1, semantic));

  const total = 70 + headroom * 16 + breadth * 4 + clamped * 10;
  return Math.max(0, Math.min(100, Math.round(total)));
}
