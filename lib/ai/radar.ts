import type { SkillMatrixOutput } from "./schemas";

export type RadarLanguage = "en" | "am";
export type TechnicalRadarKey = keyof SkillMatrixOutput["technical"];
export type HumanRadarKey = keyof SkillMatrixOutput["human"];
export type RadarAxisKey = TechnicalRadarKey | HumanRadarKey;

export type RadarAxis = {
  key: RadarAxisKey;
  group: "technical" | "human";
  label: string;
  score: number;
};

type RadarAxisDefinition =
  | { key: TechnicalRadarKey; group: "technical" }
  | { key: HumanRadarKey; group: "human" };

/** Fixed axis order keeps radar silhouettes comparable between assessments. */
export const RADAR_AXIS_ORDER = [
  { key: "digital_literacy", group: "technical" },
  { key: "ai_literacy", group: "technical" },
  { key: "data_handling", group: "technical" },
  { key: "domain_tools", group: "technical" },
  { key: "problem_solving", group: "human" },
  { key: "adaptability", group: "human" },
  { key: "communication", group: "human" },
  { key: "collaboration", group: "human" },
  { key: "empathy", group: "human" },
] as const satisfies readonly RadarAxisDefinition[];

const LABELS: Record<RadarAxisKey, Record<RadarLanguage, string>> = {
  digital_literacy: { en: "Digital literacy", am: "ዲጂታል እውቀት" },
  ai_literacy: { en: "AI literacy", am: "የAI እውቀት" },
  data_handling: { en: "Data handling", am: "የውሂብ አያያዝ" },
  domain_tools: { en: "Domain tools", am: "የሥራ መሣሪያዎች" },
  problem_solving: { en: "Problem solving", am: "ችግር መፍታት" },
  adaptability: { en: "Adaptability", am: "ተለዋዋጭነት" },
  communication: { en: "Communication", am: "ግንኙነት" },
  collaboration: { en: "Collaboration", am: "ትብብር" },
  empathy: { en: "Empathy", am: "ርኅራኄ" },
};

export function toRadarAxes(
  matrix: SkillMatrixOutput,
  language: RadarLanguage = "en",
): RadarAxis[] {
  return RADAR_AXIS_ORDER.map((axis) => ({
    ...axis,
    label: LABELS[axis.key][language],
    score:
      axis.group === "technical"
        ? matrix.technical[axis.key]
        : matrix.human[axis.key],
  }));
}

export function detectRadarLanguage(notes: string): RadarLanguage {
  return /[ሀ-፿]/u.test(notes) ? "am" : "en";
}
