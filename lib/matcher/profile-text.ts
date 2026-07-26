import type { SandboxScore, ScoreMap } from "@/lib/data/types";
import {
  COMPETENCIES,
  COMPETENCY_KEYS,
  type CompetencyKey,
} from "@/lib/sandbox/competencies";
import { getStaticNode } from "@/lib/sandbox/nodes";
import type { RoleSkillTemplate, SmePosting } from "@/lib/data/types";

/**
 * The text the semantic layer compares. Section 3 asks for "each candidate's
 * skill/score profile" on one side and the role description on the other, so
 * both sides are built here and stay symmetrical: competency wording drawn from
 * the same COMPETENCIES table, so a template asking for "customer
 * communication" and a candidate strong in it share vocabulary rather than
 * relying on whatever an SME happened to type.
 *
 * Deliberately excludes bio and region. Those describe a person, not their
 * verified capability, and Section 9 keeps the match engine on derived output.
 */

/** Above this a competency is a strength worth naming rather than noise. */
const STRENGTH = 70;

export function candidateProfileText(
  scores: ScoreMap,
  rows: SandboxScore[],
): string {
  const parts: string[] = [];

  const ranked = COMPETENCY_KEYS.filter(
    (key) => typeof scores[key] === "number",
  ).sort((a, b) => (scores[b] ?? 0) - (scores[a] ?? 0));

  const strengths = ranked.filter((key) => (scores[key] ?? 0) >= STRENGTH);
  const developing = ranked.filter((key) => (scores[key] ?? 0) < STRENGTH);

  if (strengths.length > 0) {
    parts.push(`Strong in ${describe(strengths)}.`);
  }
  if (developing.length > 0) {
    parts.push(`Developing ${describe(developing)}.`);
  }

  // Completed work, which is what distinguishes two candidates holding similar
  // numbers: the sector they proved it in.
  const nodeIds = [...new Set(rows.map((row) => row.node_id))];
  const titles: string[] = [];
  const sectors = new Set<string>();

  for (const nodeId of nodeIds) {
    const node = getStaticNode(nodeId);
    if (!node) continue;
    titles.push(node.title);
    sectors.add(node.sector);
  }

  if (titles.length > 0) {
    parts.push(`Completed ${titles.join("; ")}.`);
  }
  if (sectors.size > 0) {
    parts.push(`Sector experience: ${[...sectors].join(", ")}.`);
  }

  return parts.join(" ");
}

/**
 * The other side of the comparison. Includes the competencies the template
 * actually asks for, so a posting with a thin description still carries the
 * vocabulary a candidate profile can match against.
 */
export function roleProfileText(
  posting: SmePosting,
  template: RoleSkillTemplate,
): string {
  const parts = [template.role_name];

  if (posting.description?.trim()) parts.push(posting.description.trim());

  const asked = Object.keys(template.thresholds_json).filter(
    (key): key is CompetencyKey => key in COMPETENCIES,
  );

  if (asked.length > 0) {
    parts.push(`Requires ${describe(asked)}.`);
  }

  return parts.join(". ");
}

function describe(keys: CompetencyKey[]): string {
  return keys
    .map((key) => COMPETENCIES[key].label.toLowerCase())
    .join(", ")
    .replace(/, ([^,]*)$/, keys.length > 1 ? " and $1" : "$1");
}
