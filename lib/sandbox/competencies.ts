/**
 * FROZEN COMPETENCY VOCABULARY — the single source of truth for every score key
 * in the platform.
 *
 * Why this file exists: the spec's two examples disagree. Section 2 shows a
 * Sandbox Score as `prompt_engineering / task_accuracy / communication`, while
 * the Role Skill Template example uses `excel_basics / ai_prompt_literacy /
 * customer_comms`. The match engine compares those two JSON blobs key by key,
 * so two vocabularies means every candidate silently clears zero thresholds.
 *
 * These six keys are the reconciliation. Both `sandbox_scores.scores_json` and
 * `role_skill_templates.thresholds_json` use them, and nothing else.
 * Adding a key is a team decision, not a local one — Dev 2's skill matrix and
 * the seed personas are generated against this list.
 */

export const COMPETENCY_KEYS = [
  "ai_prompt_literacy",
  "task_accuracy",
  "customer_comms",
  "data_tools",
  "process_thinking",
  "adaptability",
] as const;

export type CompetencyKey = (typeof COMPETENCY_KEYS)[number];

export type CompetencyMeta = {
  key: CompetencyKey;
  label: string;
  /** Provisional — the non-technical lead owns final Amharic wording. */
  labelAm: string;
  short: string;
  description: string;
};

export const COMPETENCIES: Record<CompetencyKey, CompetencyMeta> = {
  ai_prompt_literacy: {
    key: "ai_prompt_literacy",
    label: "AI prompt literacy",
    labelAm: "የ AI አጠቃቀም ክህሎት",
    short: "Directing AI",
    description:
      "Can brief an AI assistant clearly, iterate on weak output, and keep the result fit for the business context. Replaces the spec's `prompt_engineering`.",
  },
  task_accuracy: {
    key: "task_accuracy",
    label: "Task accuracy",
    labelAm: "የሥራ ትክክለኛነት",
    short: "Accuracy",
    description:
      "Delivers what the brief actually asked for, with correct details and no invented facts.",
  },
  customer_comms: {
    key: "customer_comms",
    label: "Customer communication",
    labelAm: "የደንበኛ ግንኙነት",
    short: "Communication",
    description:
      "Writes clearly and appropriately for customers and colleagues. Merges the spec's `communication` and `customer_comms`.",
  },
  data_tools: {
    key: "data_tools",
    label: "Data & spreadsheet tools",
    labelAm: "የመረጃ መሣሪያዎች",
    short: "Data tools",
    description:
      "Structures records, quantities, and prices so someone else can use them. Covers the spec's `excel_basics`.",
  },
  process_thinking: {
    key: "process_thinking",
    label: "Process thinking",
    labelAm: "የሥራ ሂደት አስተሳሰብ",
    short: "Process",
    description:
      "Breaks a messy business problem into repeatable steps, sequencing, and handoffs.",
  },
  adaptability: {
    key: "adaptability",
    label: "Adaptability",
    labelAm: "ተለዋዋጭነት",
    short: "Adaptability",
    description:
      "Handles ambiguity and changed constraints without stalling. One of the latent human skills Pillar 1 surfaces.",
  },
};

export const COMPETENCY_LIST: CompetencyMeta[] = COMPETENCY_KEYS.map(
  (key) => COMPETENCIES[key],
);

export function isCompetencyKey(value: string): value is CompetencyKey {
  return (COMPETENCY_KEYS as readonly string[]).includes(value);
}

export function competencyLabel(key: string): string {
  return isCompetencyKey(key) ? COMPETENCIES[key].label : key;
}

/** Drops unknown keys and clamps to 0-100 so a bad AI response can't poison a score row. */
export function normalizeScores(
  input: Record<string, unknown>,
): Partial<Record<CompetencyKey, number>> {
  const out: Partial<Record<CompetencyKey, number>> = {};
  for (const [key, value] of Object.entries(input)) {
    if (!isCompetencyKey(key)) continue;
    const numeric = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(numeric)) continue;
    out[key] = Math.max(0, Math.min(100, Math.round(numeric)));
  }
  return out;
}
