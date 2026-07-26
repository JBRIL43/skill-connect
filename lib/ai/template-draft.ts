import { generateObject } from "ai";
import { z } from "zod";

import { aiModel, aiSource, isLiveAI, type AiSource } from "@/lib/ai/provider";
import type { ScoreMap } from "@/lib/data/types";
import {
  COMPETENCY_KEYS,
  COMPETENCIES,
  isCompetencyKey,
  type CompetencyKey,
} from "@/lib/sandbox/competencies";

export type TemplateDraft = {
  role_name: string;
  thresholds_json: ScoreMap;
  rationale: string;
  source: AiSource;
};

const draftSchema = z.object({
  role_name: z.string(),
  thresholds: z.array(
    z.object({
      competency: z.string(),
      minimum_score: z.number(),
      reason: z.string(),
    }),
  ),
  rationale: z.string(),
});

/**
 * Section 3's plain-language path: an SME describes a problem and gets a draft
 * Role Skill Template back, which they confirm or edit before saving. The draft
 * is never saved automatically — the SME owns the thresholds they hire against.
 */
export async function draftTemplate(problem: string): Promise<TemplateDraft> {
  if (isLiveAI()) {
    try {
      return await draftWithModel(problem);
    } catch (error) {
      console.error("[template-draft] live call failed, using stub draft", error);
    }
  }

  return draftLocally(problem);
}

async function draftWithModel(problem: string): Promise<TemplateDraft> {
  const vocabulary = COMPETENCY_KEYS.map(
    (key) => `${key}: ${COMPETENCIES[key].description}`,
  ).join("\n");

  const { object } = await generateObject({
    model: aiModel(),
    schema: draftSchema,
    system: [
      "You turn an Ethiopian SME's plain-language hiring problem into a reusable Role Skill Template for Skill-Connect.",
      "Choose 2 to 4 competencies from the fixed vocabulary and a minimum score between 55 and 85 for each.",
      "Only use competency keys from the vocabulary, exactly as spelled.",
      "Thresholds should be realistic for a junior hire in a small Ethiopian business, not aspirational.",
    ].join(" "),
    prompt: [
      `Fixed competency vocabulary:\n${vocabulary}`,
      `SME's description of the problem: ${problem}`,
      "Return a short role name in title case, the thresholds, and a two-sentence rationale addressed to the SME.",
    ].join("\n\n"),
  });

  const thresholds: ScoreMap = {};
  for (const entry of object.thresholds) {
    if (!isCompetencyKey(entry.competency)) continue;
    thresholds[entry.competency] = Math.max(
      40,
      Math.min(95, Math.round(entry.minimum_score)),
    );
  }

  if (Object.keys(thresholds).length === 0) {
    return draftLocally(problem);
  }

  return {
    role_name: object.role_name.trim(),
    thresholds_json: thresholds,
    rationale: object.rationale.trim(),
    source: aiSource(),
  };
}

const KEYWORD_MAP: { competency: CompetencyKey; pattern: RegExp; weight: number }[] = [
  { competency: "ai_prompt_literacy", pattern: /\b(ai|automate|automation|chatgpt|prompt|generate|draft)\b/i, weight: 78 },
  { competency: "data_tools", pattern: /\b(inventory|stock|spreadsheet|excel|records|numbers|report|price|accounting)\b/i, weight: 72 },
  { competency: "customer_comms", pattern: /\b(customer|client|whatsapp|telegram|message|sales|support|reply|order)\b/i, weight: 70 },
  { competency: "process_thinking", pattern: /\b(process|schedule|delivery|logistics|route|workflow|coordinate|operations)\b/i, weight: 72 },
  { competency: "adaptability", pattern: /\b(change|changing|urgent|unpredictable|late|breakdown|flexible|shift)\b/i, weight: 66 },
  { competency: "task_accuracy", pattern: /\b(accurate|accuracy|mistake|error|detail|careful|quality|check)\b/i, weight: 74 },
];

function titleCase(value: string): string {
  return value
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/** Deterministic keyword mapping so the free-text path works without an API key. */
export function draftLocally(problem: string): TemplateDraft {
  const matched = KEYWORD_MAP.filter((entry) => entry.pattern.test(problem));

  // Every role needs an accuracy floor, and AI fluency is the platform's premise.
  const chosen = matched.length
    ? matched.slice(0, 4)
    : [
        KEYWORD_MAP.find((entry) => entry.competency === "ai_prompt_literacy")!,
        KEYWORD_MAP.find((entry) => entry.competency === "task_accuracy")!,
      ];

  const thresholds: ScoreMap = {};
  for (const entry of chosen) thresholds[entry.competency] = entry.weight;
  if (thresholds.task_accuracy === undefined) thresholds.task_accuracy = 70;

  const noun = /\b(inventory|stock)\b/i.test(problem)
    ? "Inventory Assistant"
    : /\b(delivery|route|logistics|schedule)\b/i.test(problem)
      ? "Delivery Coordinator"
      : /\b(customer|support|whatsapp|order|sales)\b/i.test(problem)
        ? "AI Sales Assistant"
        : /\b(record|report|data|accounting)\b/i.test(problem)
          ? "Records Assistant"
          : "AI Operations Assistant";

  const named = Object.keys(thresholds)
    .map((key) => COMPETENCIES[key as CompetencyKey].label.toLowerCase())
    .join(", ");

  return {
    role_name: titleCase(noun),
    thresholds_json: thresholds,
    rationale: `Based on your description, this role is scored on ${named}. Adjust any minimum before saving — candidates only appear once they clear every threshold you keep.`,
    source: "stub",
  };
}
