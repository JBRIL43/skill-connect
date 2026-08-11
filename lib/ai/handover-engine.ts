import { generateText, Output } from "ai";
import { z } from "zod";

import type { RawInterviewJson } from "./handover";
import { getAiModel } from "./model";

export const continuityBriefSchema = z.object({
  title: z.string().trim().min(3).max(120),
  overview: z.string().trim().min(20).max(800),
  recurring_tasks: z.array(z.string().trim().min(3).max(240)).min(2).max(8),
  tools_and_systems: z.array(z.string().trim().min(2).max(160)).min(1).max(8),
  decision_points: z.array(z.string().trim().min(3).max(240)).min(1).max(6),
  shortcuts: z.array(z.string().trim().min(3).max(240)).min(0).max(6),
  coordination: z.array(z.string().trim().min(3).max(240)).min(1).max(6),
  failure_modes: z.array(z.string().trim().min(3).max(240)).min(1).max(6),
  onboarding_checklist: z.array(z.string().trim().min(3).max(240)).min(3).max(8),
});

export type ContinuityBriefDraft = z.infer<typeof continuityBriefSchema>;

export const BRIEF_SUMMARIZATION_PROMPT = `
You write Continuity Briefs for Skill-Connect Ethiopia Institutional Handover.
Use only evidence from the outgoing employee's interview transcript.
Prefer role descriptions over personal names. If a personal or client name
appears, replace it with a role label such as "the warehouse supervisor" or
"the regular wholesale buyer".
Never invent tools, tasks, or contacts that were not discussed.
Write in the same language as the interview (English or Amharic).
Keep each bullet concrete and useful for the next person in the role.
`.trim();

export function formatContinuityBrief(draft: ContinuityBriefDraft): string {
  const section = (heading: string, items: string[]) =>
    items.length === 0
      ? ""
      : `\n## ${heading}\n${items.map((item) => `- ${item}`).join("\n")}`;

  return [
    `# ${draft.title}`,
    "",
    draft.overview,
    section("Recurring tasks", draft.recurring_tasks),
    section("Tools and systems", draft.tools_and_systems),
    section("Decision points", draft.decision_points),
    section("Shortcuts", draft.shortcuts),
    section("Coordination", draft.coordination),
    section("Common failure modes", draft.failure_modes),
    section("Onboarding checklist", draft.onboarding_checklist),
  ]
    .filter(Boolean)
    .join("\n")
    .trim();
}

export async function generateContinuityBriefDraft(
  interview: RawInterviewJson,
): Promise<{ draft: ContinuityBriefDraft; markdown: string }> {
  const transcript = interview.messages
    .map(({ role, content }) => `${role.toUpperCase()}: ${content}`)
    .join("\n\n");

  const { output } = await generateText({
    model: getAiModel(),
    system: BRIEF_SUMMARIZATION_PROMPT,
    output: Output.object({
      name: "continuity_brief",
      description: "Readable Continuity Brief for an outgoing employee review",
      schema: continuityBriefSchema,
    }),
    prompt: JSON.stringify(
      {
        locale: interview.locale,
        completed_at: interview.completed_at,
        transcript,
      },
      null,
      2,
    ),
    temperature: 0.2,
  });

  if (!output) {
    throw new Error("The model did not return a Continuity Brief");
  }

  return {
    draft: output,
    markdown: formatContinuityBrief(output),
  };
}
