import { cn } from "@/lib/utils";

/**
 * One competency score, 0-100 (Section 3).
 *
 * Every pillar renders these — the coach's initial read, Sandbox Scores, Match
 * Scores, the admin table — so the colour thresholds live here once. If a
 * screen shows a number out of 100, it should use this rather than styling its
 * own pill.
 *
 * Pass `threshold` when the number is being judged against a Role Skill
 * Template bar ("Excel basics ≥ 70"). In that context the only thing an SME
 * cares about is cleared or not cleared, so the banding switches to binary.
 */

type Band = { label: string; dot: string };

const STRONG: Band = { label: "Strong", dot: "bg-chart-1" };
const DEVELOPING: Band = { label: "Developing", dot: "bg-chart-2" };
const EARLY: Band = { label: "Early", dot: "bg-chart-5" };

function bandFor(score: number, threshold?: number): Band {
  if (threshold !== undefined) {
    return score >= threshold ? STRONG : EARLY;
  }
  if (score >= 75) return STRONG;
  if (score >= 60) return DEVELOPING;
  return EARLY;
}

export function ScoreBadge({
  score,
  label,
  threshold,
  className,
}: {
  score: number;
  label?: string;
  threshold?: number;
  className?: string;
}) {
  const rounded = Math.round(score);
  const band = bandFor(rounded, threshold);

  const title =
    threshold === undefined
      ? `${band.label}: ${rounded} out of 100`
      : `${rounded} out of 100, against a bar of ${threshold}`;

  return (
    <span
      title={title}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border bg-card px-2.5 py-1 text-xs font-medium",
        className,
      )}
    >
      <span className={cn("size-1.5 shrink-0 rounded-full", band.dot)} />
      {label ? <span className="text-muted-foreground">{label}</span> : null}
      <span className="tabular-nums">{rounded}</span>
      {threshold === undefined ? null : (
        <span className="text-muted-foreground tabular-nums">/{threshold}</span>
      )}
    </span>
  );
}
