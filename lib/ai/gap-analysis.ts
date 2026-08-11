import { generateText } from "ai";

import { aiModel, isLiveAI } from "@/lib/ai/provider";
import type { ScoreMap } from "@/lib/data/types";
import { COMPETENCIES, type CompetencyKey } from "@/lib/sandbox/competencies";

export type GapInput = {
  candidateFirstName: string;
  roleName: string;
  /** Candidate's best score per competency — derived data only. */
  scores: ScoreMap;
  thresholds: ScoreMap;
};

export type GapBreakdown = {
  competency: CompetencyKey;
  required: number;
  actual: number | null;
  delta: number | null;
};

export function gapBreakdown(input: GapInput): GapBreakdown[] {
  return (Object.keys(input.thresholds) as CompetencyKey[]).map((competency) => {
    const required = input.thresholds[competency] ?? 0;
    const actual = input.scores[competency] ?? null;
    return {
      competency,
      required,
      actual,
      delta: actual === null ? null : actual - required,
    };
  });
}

/**
 * The only candidate-specific text an SME ever sees, alongside the Match Score.
 * Built from derived scores — the raw skill matrix and intake transcript are
 * never passed in here (Section 9, point 1).
 */
export async function gapAnalysis(input: GapInput): Promise<string> {
  const breakdown = gapBreakdown(input);

  if (isLiveAI()) {
    try {
      const lines = breakdown
        .map(
          (item) =>
            `${COMPETENCIES[item.competency].label}: scored ${item.actual ?? "not attempted"} against a required ${item.required}`,
        )
        .join("\n");

      const { text } = await generateText({
        model: aiModel(),
        system: [
          "You write a two-sentence Gap Analysis for an Ethiopian SME reviewing a candidate on Skill-Connect.",
          "Sentence one: the candidate's clearest strength for this role, with the number.",
          "Sentence two: what onboarding or support they would need, framed practically.",
          "Never speculate about the person's background, character, or personal circumstances — only the scores given.",
        ].join(" "),
        prompt: `Role: ${input.roleName}\nCandidate first name: ${input.candidateFirstName}\nVerified scores versus role thresholds:\n${lines}`,
      });

      const trimmed = text.trim();
      if (trimmed) return trimmed;
    } catch (error) {
      console.error("[gap-analysis] live call failed, using stub text", error);
    }
  }

  return gapAnalysisLocally(input, breakdown);
}

export function gapAnalysisLocally(
  input: GapInput,
  breakdown = gapBreakdown(input),
): string {
  const scored = breakdown.filter((item) => item.actual !== null);
  const strengths = scored
    .filter((item) => (item.delta ?? 0) >= 0)
    .sort((a, b) => (b.delta ?? 0) - (a.delta ?? 0));
  const shortfalls = scored
    .filter((item) => (item.delta ?? 0) < 0)
    .sort((a, b) => (a.delta ?? 0) - (b.delta ?? 0));
  const untested = breakdown.filter((item) => item.actual === null);

  const name = input.candidateFirstName;
  const parts: string[] = [];

  if (strengths.length) {
    const top = strengths[0];
    const extra = strengths.slice(1, 3);
    parts.push(
      `${name} is strong in ${COMPETENCIES[top.competency].label.toLowerCase()} at ${top.actual} against the ${top.required} you require${
        extra.length
          ? `, and also clears ${extra
              .map(
                (item) =>
                  `${COMPETENCIES[item.competency].label.toLowerCase()} (${item.actual})`,
              )
              .join(" and ")}`
          : ""
      }.`,
    );
  }

  if (shortfalls.length) {
    const worst = shortfalls[0];
    parts.push(
      `Would need onboarding in ${COMPETENCIES[worst.competency].label.toLowerCase()}, currently ${worst.actual} against ${worst.required}${
        shortfalls.length > 1
          ? `, plus support in ${shortfalls
              .slice(1, 3)
              .map((item) => COMPETENCIES[item.competency].label.toLowerCase())
              .join(" and ")}`
          : ""
      }.`,
    );
  } else if (untested.length) {
    parts.push(
      `Has not yet attempted a challenge covering ${untested
        .map((item) => COMPETENCIES[item.competency].label.toLowerCase())
        .join(" or ")}, so that part of the role is unverified.`,
    );
  } else {
    parts.push(
      `Clears every threshold on this template, so onboarding can focus on your business specifics rather than core skills.`,
    );
  }

  return parts.join(" ");
}
