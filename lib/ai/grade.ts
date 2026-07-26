import { generateObject } from "ai";
import { z } from "zod";

import { aiModel, aiSource, isLiveAI, type AiSource } from "@/lib/ai/provider";
import {
  clampScore,
  hashJitter,
  keywordCoverage,
  textShape,
  type TextShape,
} from "@/lib/ai/text-signals";
import { weightedOverall } from "@/lib/data/derive";
import type { SandboxMode, ScoreMap } from "@/lib/data/types";
import {
  COMPETENCIES,
  isCompetencyKey,
  normalizeScores,
  type CompetencyKey,
} from "@/lib/sandbox/competencies";
import type { SandboxNode } from "@/lib/sandbox/nodes";

export type GradeLine = {
  competency: CompetencyKey;
  score: number;
  comment: string;
};

export type GradeResult = {
  scores: ScoreMap;
  overall: number;
  lines: GradeLine[];
  summary: string;
  source: AiSource;
};

export type AssistTurn = { role: "user" | "assistant"; content: string };

export type GradeArgs = {
  node: SandboxNode;
  submission: string;
  transcript: AssistTurn[];
  mode: SandboxMode;
};

const gradeSchema = z.object({
  lines: z.array(
    z.object({
      competency: z.string(),
      score: z.number(),
      comment: z.string(),
    }),
  ),
  summary: z.string(),
});

/**
 * The one grading path for the whole platform. Pillar 2's challenges and Pillar
 * 3b's generated transition challenges both come through here, which is why the
 * node is a parameter rather than hardcoded content.
 */
export async function gradeSubmission(args: GradeArgs): Promise<GradeResult> {
  if (isLiveAI()) {
    try {
      return await gradeWithModel(args);
    } catch (error) {
      // Never let a rate limit or a network blip end the demo — fall through to
      // the deterministic grader and say so in the result.
      console.error("[grade] live grading failed, using stub grader", error);
    }
  }

  return gradeLocally(args);
}

async function gradeWithModel(args: GradeArgs): Promise<GradeResult> {
  const { node, submission, transcript, mode } = args;

  const rubricText = node.rubric
    .map(
      (line) =>
        `- ${line.competency} (weight ${line.weight}): ${line.criteria}`,
    )
    .join("\n");

  const transcriptText = transcript.length
    ? transcript
        .map((turn) => `${turn.role === "user" ? "Candidate" : "Assistant"}: ${turn.content}`)
        .join("\n")
    : "(the candidate did not use the assistant)";

  const { object } = await generateObject({
    model: aiModel(),
    schema: gradeSchema,
    system: [
      "You grade a work-simulation challenge on Skill-Connect Ethiopia.",
      "The candidate is expected to solve the task WITH an AI assistant, so using the assistant well is part of the skill, not cheating.",
      "Score each rubric competency from 0 to 100 against its stated criteria only.",
      "Be specific and evidence-based in comments, referring to what the candidate actually wrote.",
      "Critique the work product, never the person.",
      mode === "pressure_simulation"
        ? "This submission was produced under the optional pressure simulation. Judge the work on the same standard; do not penalise the candidate for the mode."
        : "",
    ]
      .filter(Boolean)
      .join(" "),
    prompt: [
      `Business scenario: ${node.scenario}`,
      `Required deliverable: ${node.deliverable}`,
      `Rubric:\n${rubricText}`,
      `Conversation with the AI assistant:\n${transcriptText}`,
      `Candidate's submitted work:\n${submission}`,
      `Return one line per rubric competency using exactly these keys: ${node.rubric
        .map((line) => line.competency)
        .join(", ")}. Also return a two-sentence summary.`,
    ].join("\n\n"),
  });

  const allowed = new Set(node.rubric.map((line) => line.competency));
  const rawScores: Record<string, number> = {};
  const comments = new Map<CompetencyKey, string>();

  for (const line of object.lines) {
    if (!isCompetencyKey(line.competency)) continue;
    if (!allowed.has(line.competency)) continue;
    rawScores[line.competency] = line.score;
    comments.set(line.competency, line.comment.trim());
  }

  const scores = normalizeScores(rawScores);

  // A model that skipped a competency would otherwise produce a partial score
  // row, which quietly breaks threshold matching later.
  if (Object.keys(scores).length !== node.rubric.length) {
    const fallback = gradeLocally(args);
    for (const line of node.rubric) {
      if (scores[line.competency] === undefined) {
        scores[line.competency] = fallback.scores[line.competency];
        comments.set(
          line.competency,
          fallback.lines.find((item) => item.competency === line.competency)
            ?.comment ?? "",
        );
      }
    }
  }

  const lines: GradeLine[] = node.rubric.map((line) => ({
    competency: line.competency,
    score: scores[line.competency] ?? 0,
    comment:
      comments.get(line.competency) ??
      `Graded against: ${line.criteria}`,
  }));

  return {
    scores,
    overall: weightedOverall(scores, node.rubric),
    lines,
    summary: object.summary.trim(),
    source: aiSource(),
  };
}

type LocalContext = {
  shape: TextShape;
  coverage: number;
  userTurns: number;
  avgUserTurnWords: number;
};

function localScore(
  competency: CompetencyKey,
  ctx: LocalContext,
  seed: string,
): number {
  const { shape, coverage, userTurns, avgUserTurnWords } = ctx;
  const covered = coverage * 100;

  let base: number;
  switch (competency) {
    case "ai_prompt_literacy":
      base =
        42 +
        Math.min(userTurns * 7, 21) +
        Math.min(avgUserTurnWords / 2, 12) +
        covered * 0.15;
      break;
    case "task_accuracy":
      base =
        40 +
        covered * 0.35 +
        Math.min(shape.digitGroups * 2, 10) +
        (shape.words > 80 ? 6 : 0);
      break;
    case "customer_comms":
      base =
        44 +
        (shape.listLines > 0 ? 8 : 0) +
        (shape.avgSentenceWords >= 8 && shape.avgSentenceWords <= 22 ? 12 : 4) +
        covered * 0.18 +
        (shape.hasCurrency ? 4 : 0);
      break;
    case "data_tools":
      base =
        40 +
        Math.min(shape.digitGroups * 2.5, 18) +
        (shape.listLines >= 3 ? 10 : 0) +
        covered * 0.18;
      break;
    case "process_thinking":
      base =
        40 +
        Math.min(shape.sequenceWords * 4, 16) +
        (shape.listLines >= 3 ? 10 : 0) +
        covered * 0.18;
      break;
    case "adaptability":
      base =
        42 +
        Math.min(shape.contingencyWords * 4, 18) +
        covered * 0.16 +
        (shape.lines >= 4 ? 6 : 0);
      break;
  }

  return clampScore(base + hashJitter(`${seed}:${competency}`));
}

function localComment(
  competency: CompetencyKey,
  score: number,
  ctx: LocalContext,
): string {
  const meta = COMPETENCIES[competency];
  const band = score >= 78 ? "strong" : score >= 65 ? "solid" : "developing";

  const evidence: Record<CompetencyKey, string> = {
    ai_prompt_literacy: `${ctx.userTurns} exchange${ctx.userTurns === 1 ? "" : "s"} with the assistant, averaging ${Math.round(ctx.avgUserTurnWords)} words per instruction`,
    task_accuracy: `${Math.round(ctx.coverage * 100)}% of the brief's key elements appear in the submission`,
    customer_comms: `${ctx.shape.lines} line${ctx.shape.lines === 1 ? "" : "s"} of copy, ${Math.round(ctx.shape.avgSentenceWords)} words per sentence on average`,
    data_tools: `${ctx.shape.digitGroups} numeric value${ctx.shape.digitGroups === 1 ? "" : "s"} and ${ctx.shape.listLines} structured line${ctx.shape.listLines === 1 ? "" : "s"}`,
    process_thinking: `${ctx.shape.sequenceWords} sequencing marker${ctx.shape.sequenceWords === 1 ? "" : "s"} across ${ctx.shape.lines} section${ctx.shape.lines === 1 ? "" : "s"}`,
    adaptability: `${ctx.shape.contingencyWords} contingency reference${ctx.shape.contingencyWords === 1 ? "" : "s"} in the plan`,
  };

  const verdict: Record<string, string> = {
    strong: `Clearly meets the bar for ${meta.label.toLowerCase()}`,
    solid: `Meets the bar for ${meta.label.toLowerCase()} with room to sharpen`,
    developing: `Below the bar for ${meta.label.toLowerCase()} on this attempt`,
  };

  return `${verdict[band]} — ${evidence[competency]}.`;
}

/**
 * Deterministic offline grader. Used whenever AI_MODE is not live, and as the
 * automatic fallback when a live call fails during judging.
 */
export function gradeLocally(args: GradeArgs): GradeResult {
  const { node, submission, transcript } = args;

  const userTurns = transcript.filter((turn) => turn.role === "user");
  const avgUserTurnWords = userTurns.length
    ? userTurns.reduce(
        (sum, turn) => sum + turn.content.trim().split(/\s+/).filter(Boolean).length,
        0,
      ) / userTurns.length
    : 0;

  const ctx: LocalContext = {
    shape: textShape(submission),
    coverage: keywordCoverage(
      `${node.scenario} ${node.deliverable}`,
      `${submission} ${userTurns.map((turn) => turn.content).join(" ")}`,
    ),
    userTurns: userTurns.length,
    avgUserTurnWords,
  };

  const seed = `${node.id}:${submission.length}:${submission.slice(0, 64)}`;
  const scores: ScoreMap = {};
  const lines: GradeLine[] = [];

  for (const rubricLine of node.rubric) {
    const score = localScore(rubricLine.competency, ctx, seed);
    scores[rubricLine.competency] = score;
    lines.push({
      competency: rubricLine.competency,
      score,
      comment: localComment(rubricLine.competency, score, ctx),
    });
  }

  const overall = weightedOverall(scores, node.rubric);
  const strongest = [...lines].sort((a, b) => b.score - a.score)[0];
  const weakest = [...lines].sort((a, b) => a.score - b.score)[0];

  return {
    scores,
    overall,
    lines,
    summary: `Scored ${overall}/100 overall on ${node.title}. Strongest area was ${COMPETENCIES[strongest.competency].label.toLowerCase()} at ${strongest.score}, and ${COMPETENCIES[weakest.competency].label.toLowerCase()} at ${weakest.score} is where another attempt would move the number most.`,
    source: "stub",
  };
}
