import { z } from "zod";

import { skillMatrixSchema, type SkillMatrixOutput } from "./schemas";
import {
  SANDBOX_NODE_ID_TUPLE,
  type SandboxCompetencyKey,
} from "./sandbox-catalog";

export const careerRecommendationSchema = z.object({
  recommendations: z
    .array(
      z.object({
        path_name: z.string().trim().min(3).max(80),
        reason: z.string().trim().min(20).max(280),
        node_ids: z.array(z.enum(SANDBOX_NODE_ID_TUPLE)).min(1).max(2),
      }),
    )
    .min(2)
    .max(3),
});

export type CareerRecommendations = z.infer<typeof careerRecommendationSchema>;

export const recommendationsRequestSchema = z.object({
  skills_json: skillMatrixSchema,
});

/**
 * Maps coach intake axes onto Dev 3's frozen sandbox competency keys so
 * recommendations can target real challenges without inventing node IDs.
 */
export function coachSignalsToSandboxCompetencies(
  matrix: SkillMatrixOutput,
): Record<SandboxCompetencyKey, number> {
  return {
    ai_prompt_literacy: average([
      matrix.technical.ai_literacy,
      matrix.technical.digital_literacy,
    ]),
    task_accuracy: average([
      matrix.technical.domain_tools,
      matrix.human.problem_solving,
    ]),
    customer_comms: average([
      matrix.human.communication,
      matrix.human.collaboration,
      matrix.human.empathy,
    ]),
    data_tools: average([
      matrix.technical.data_handling,
      matrix.technical.domain_tools,
    ]),
    process_thinking: average([
      matrix.human.problem_solving,
      matrix.technical.digital_literacy,
    ]),
    adaptability: matrix.human.adaptability,
  };
}

function average(values: number[]) {
  return Math.round(
    values.reduce((sum, value) => sum + value, 0) / values.length,
  );
}
