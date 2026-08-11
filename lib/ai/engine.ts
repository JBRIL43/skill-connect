import { generateText, Output, streamText, type ModelMessage } from "ai";

import { getAiModel } from "./model";
import { promptForMode, SKILL_EXTRACTION_PROMPT } from "./prompts";
import {
  careerRecommendationSchema,
  coachSignalsToSandboxCompetencies,
  type CareerRecommendations,
} from "./recommendations";
import { SANDBOX_CATALOG, getCatalogNode } from "./sandbox-catalog";
import {
  skillMatrixSchema,
  type ConversationMessage,
  type ConversationMode,
  type SkillMatrixOutput,
} from "./schemas";

function toModelMessages(messages: ConversationMessage[]): ModelMessage[] {
  return messages.map(({ role, content }) => ({ role, content }));
}

export function streamConversation({
  mode,
  messages,
}: {
  mode: ConversationMode;
  messages: ConversationMessage[];
}) {
  return streamText({
    model: getAiModel(),
    system: promptForMode(mode),
    messages: toModelMessages(messages),
    temperature: 0.4,
  });
}

export async function extractSkillMatrix(
  messages: ConversationMessage[],
): Promise<SkillMatrixOutput> {
  const transcript = messages
    .map(({ role, content }) => `${role.toUpperCase()}: ${content}`)
    .join("\n\n");

  const { output } = await generateText({
    model: getAiModel(),
    system: SKILL_EXTRACTION_PROMPT,
    output: Output.object({
      name: "skill_matrix",
      description: "A stable preliminary skill matrix for Skill-Connect",
      schema: skillMatrixSchema,
    }),
    prompt: transcript,
    temperature: 0.2,
  });

  if (!output) {
    throw new Error("The model did not return a skill matrix");
  }

  return output;
}

export function calculateReadinessScore(matrix: SkillMatrixOutput) {
  const scores = [
    ...Object.values(matrix.technical),
    ...Object.values(matrix.human),
  ];

  return Math.round(
    scores.reduce((total, current) => total + current, 0) / scores.length,
  );
}

const RECOMMENDATION_PROMPT = `You recommend 2–3 AI-resilient career paths for Skill-Connect Ethiopia.
Use only the provided Sandbox challenges. Every node_id MUST be one of the
allow-listed IDs. Prefer challenges that close the weakest mapped competencies.
Keep path names concrete and Ethiopia-relevant. Reasons must stay short and
honest: this is still a coach initial read, not a verified Sandbox Score.`;

export async function recommendCareerPaths(
  matrix: SkillMatrixOutput,
): Promise<CareerRecommendations> {
  const mapped = coachSignalsToSandboxCompetencies(matrix);
  const catalog = SANDBOX_CATALOG.map((node) => ({
    id: node.id,
    title: node.title,
    sector: node.sector,
    competencies: node.competencies,
    summary: node.summary,
  }));

  const { output } = await generateText({
    model: getAiModel(),
    system: RECOMMENDATION_PROMPT,
    output: Output.object({
      name: "career_recommendations",
      description: "2–3 career paths linked to real Sandbox node IDs",
      schema: careerRecommendationSchema,
    }),
    prompt: JSON.stringify(
      {
        coach_matrix: matrix,
        mapped_sandbox_competencies: mapped,
        allowlisted_nodes: catalog,
      },
      null,
      2,
    ),
    temperature: 0.3,
  });

  if (!output) {
    throw new Error("The model did not return career recommendations");
  }

  return sanitizeRecommendations(output);
}

/** Drop any hallucinated IDs that somehow pass schema validation gaps. */
export function sanitizeRecommendations(
  value: CareerRecommendations,
): CareerRecommendations {
  const recommendations = value.recommendations
    .map((item) => ({
      ...item,
      node_ids: item.node_ids.filter((id) => Boolean(getCatalogNode(id))),
    }))
    .filter((item) => item.node_ids.length > 0)
    .slice(0, 3);

  if (recommendations.length < 2) {
    throw new Error("Recommendations must reference at least two real Sandbox nodes");
  }

  return { recommendations };
}
