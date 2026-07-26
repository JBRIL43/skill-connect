import { generateObject } from "ai";
import { z } from "zod";

import { aiModel, isLiveAI } from "@/lib/ai/provider";
import type {
  ContinuityBrief,
  RawInterview,
  ScoreMap,
  SmePosting,
} from "@/lib/data/types";
import { normalizeInterview } from "@/lib/handover/normalize";
import {
  COMPETENCIES,
  isCompetencyKey,
  type CompetencyKey,
} from "@/lib/sandbox/competencies";
import type { RubricLine, SandboxNode } from "@/lib/sandbox/nodes";

const DEFAULT_COMPETENCIES: CompetencyKey[] = [
  "process_thinking",
  "task_accuracy",
  "adaptability",
];

const generatedSchema = z.object({
  title: z.string(),
  summary: z.string(),
  scenario: z.string(),
  deliverable: z.string(),
  rubric: z.array(
    z.object({
      competency: z.string(),
      criteria: z.string(),
    }),
  ),
});

export type TransitionChallengeArgs = {
  posting: SmePosting;
  brief: ContinuityBrief;
  /** The role's template thresholds, so the generated node scores what the SME actually requires. */
  thresholds?: ScoreMap;
};

export function transitionNodeId(postingId: string): string {
  return `transition-${postingId}`;
}

/**
 * The interview is nullable in the schema — a brief can exist before the
 * handover interview has run. Every field is optional anyway, so an empty
 * interview degrades to the generic transition scenario rather than throwing.
 *
 * Normalized because two interview shapes now reach this table; see
 * lib/handover/normalize.ts for which, and why reading only one of them fails
 * without ever raising an error.
 */
function interviewOf(args: TransitionChallengeArgs): RawInterview {
  return normalizeInterview(
    args.brief.raw_interview_json,
    args.brief.generated_brief,
  );
}

/**
 * Section 2, point 4: a resignation becomes a real, scored challenge rather than
 * only a text brief. Reuses the Pillar 2 node shape exactly, so grading, badges,
 * and matching all work on it without a second code path.
 *
 * Callers must pass a brief with reviewed_by_employee = true. Never generate from
 * an unreviewed interview.
 */
export async function generateTransitionChallenge(
  args: TransitionChallengeArgs,
): Promise<SandboxNode> {
  const competencies = pickCompetencies(args.thresholds);

  if (isLiveAI()) {
    try {
      return await generateWithModel(args, competencies);
    } catch (error) {
      console.error(
        "[challenge-gen] live call failed, using deterministic generator",
        error,
      );
    }
  }

  return generateLocally(args, competencies);
}

function pickCompetencies(thresholds?: ScoreMap): CompetencyKey[] {
  const fromTemplate = thresholds
    ? (Object.keys(thresholds) as CompetencyKey[]).filter(isCompetencyKey)
    : [];
  return fromTemplate.length ? fromTemplate.slice(0, 4) : DEFAULT_COMPETENCIES;
}

function evenWeights(competencies: CompetencyKey[]): number[] {
  const share = Number((1 / competencies.length).toFixed(2));
  const weights = competencies.map(() => share);
  const drift = Number((1 - share * competencies.length).toFixed(2));
  weights[weights.length - 1] = Number((share + drift).toFixed(2));
  return weights;
}

function roleTitle(args: TransitionChallengeArgs): string {
  return interviewOf(args).role_title?.trim() || "Transition role";
}

async function generateWithModel(
  args: TransitionChallengeArgs,
  competencies: CompetencyKey[],
): Promise<SandboxNode> {
  const interview = interviewOf(args);

  const { object } = await generateObject({
    model: aiModel(),
    schema: generatedSchema,
    system: [
      "You convert a departing employee's reviewed handover interview into a scored work-simulation challenge for candidates replacing them.",
      "The challenge must test the actual job, not a generic rubric: use the real recurring tasks, tools, and coordination described.",
      "Never include client names or internal identifiers, even if they appear in the source material.",
      "The candidate will solve it with an AI assistant, so the task should be a realistic first-week deliverable rather than a quiz.",
    ].join(" "),
    prompt: [
      `Role title: ${roleTitle(args)}`,
      `Posting description: ${args.posting.description}`,
      `Recurring tasks: ${(interview.recurring_tasks ?? []).join("; ") || "not specified"}`,
      `Tools used: ${(interview.tools ?? []).join("; ") || "not specified"}`,
      `Shortcuts and hard-won knowledge: ${(interview.shortcuts ?? []).join("; ") || "not specified"}`,
      `Coordinates with: ${(interview.coordinates_with ?? []).join("; ") || "not specified"}`,
      `Continuity brief: ${args.brief.generated_brief}`,
      `Write one rubric line for each of these competencies, in this order, using exactly these keys: ${competencies.join(", ")}.`,
    ].join("\n"),
  });

  const weights = evenWeights(competencies);
  const criteriaByKey = new Map<string, string>();
  for (const line of object.rubric) {
    if (isCompetencyKey(line.competency)) {
      criteriaByKey.set(line.competency, line.criteria.trim());
    }
  }

  const rubric: RubricLine[] = competencies.map((competency, index) => ({
    competency,
    weight: weights[index],
    criteria:
      criteriaByKey.get(competency) ??
      `${COMPETENCIES[competency].description} Applied to the ${roleTitle(args).toLowerCase()} handover.`,
  }));

  return {
    id: transitionNodeId(args.posting.id),
    title: object.title.trim(),
    titleAm: object.title.trim(),
    sector: "transition",
    difficulty: "core",
    estimatedMinutes: 30,
    summary: object.summary.trim(),
    scenario: object.scenario.trim(),
    deliverable: object.deliverable.trim(),
    rubric,
    assistantContext: `The user is completing a Skill-Connect transition-role challenge modelled on a real ${roleTitle(args)} handover at an Addis Ababa SME.`,
    requires: [],
    badgeName: `${roleTitle(args)} Handover Ready`,
    pressureSimulationAllowed: false,
    generatedFromPostingId: args.posting.id,
  };
}

/** Deterministic assembly from the reviewed interview — no API key required. */
export function generateLocally(
  args: TransitionChallengeArgs,
  competencies: CompetencyKey[] = pickCompetencies(args.thresholds),
): SandboxNode {
  const interview = interviewOf(args);
  const title = roleTitle(args);
  const tasks = interview.recurring_tasks ?? [];
  const tools = interview.tools ?? [];
  const partners = interview.coordinates_with ?? [];
  const shortcuts = interview.shortcuts ?? [];
  const weights = evenWeights(competencies);

  const scenario = [
    `You are taking over the ${title.toLowerCase()} role at an Addis Ababa SME. The person who held it has left, and this is what the job actually involved, in their words.`,
    tasks.length ? `Recurring work: ${tasks.join("; ")}.` : "",
    tools.length ? `Tools in use: ${tools.join(", ")}.` : "",
    partners.length ? `You coordinate with: ${partners.join(", ")}.` : "",
    shortcuts.length
      ? `Hard-won details they wanted passed on: ${shortcuts.join("; ")}.`
      : "",
  ]
    .filter(Boolean)
    .join(" ");

  const deliverable = [
    `A first-week operating plan for this role: how you would run the recurring work above day to day,`,
    tools.length ? `which of the existing tools you would keep or change,` : "",
    `what you would do on a day when something goes wrong,`,
    partners.length
      ? `and the message you would send the people you coordinate with in your first week.`
      : `and the first thing you would document that the previous person never wrote down.`,
  ]
    .filter(Boolean)
    .join(" ");

  const rubric: RubricLine[] = competencies.map((competency, index) => ({
    competency,
    weight: weights[index],
    criteria: transitionCriteria(competency, title, tasks.length),
  }));

  return {
    id: transitionNodeId(args.posting.id),
    title: `${title} handover challenge`,
    titleAm: `${title} የሽግግር ተግዳሮት`,
    sector: "transition",
    difficulty: "core",
    estimatedMinutes: 30,
    summary: `Scored against the real ${title.toLowerCase()} job that just came open, generated from the outgoing employee's reviewed handover interview.`,
    scenario,
    deliverable,
    rubric,
    assistantContext: `The user is completing a Skill-Connect transition-role challenge modelled on a real ${title} handover at an Addis Ababa SME.`,
    requires: [],
    badgeName: `${title} Handover Ready`,
    pressureSimulationAllowed: false,
    generatedFromPostingId: args.posting.id,
  };
}

function transitionCriteria(
  competency: CompetencyKey,
  title: string,
  taskCount: number,
): string {
  switch (competency) {
    case "process_thinking":
      return `Sequences the ${taskCount || "recurring"} recurring duties of the ${title.toLowerCase()} into a workable daily order, including who is handed what.`;
    case "task_accuracy":
      return `Works from the actual duties, tools, and constraints described in the handover rather than inventing a generic version of the job.`;
    case "adaptability":
      return `Has a concrete answer for the day something goes wrong, with a priority order rather than a vague promise to cope.`;
    case "customer_comms":
      return `The message to the people this role coordinates with is clear, short, and would actually reassure them mid-transition.`;
    case "data_tools":
      return `Handles the records and numbers this role owns in a structure someone else could pick up.`;
    case "ai_prompt_literacy":
      return `Uses the assistant to pressure-test the plan against the real constraints instead of asking it for a template.`;
  }
}
