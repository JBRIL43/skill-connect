import type { CompetencyKey } from "@/lib/sandbox/competencies";
import type {
  ContinuityBrief as DbContinuityBrief,
  RoleSkillTemplate as DbRoleSkillTemplate,
  SandboxScore as DbSandboxScore,
} from "@/lib/types/database";

/**
 * Dev 1's lib/types/database.ts is the source of truth for row shapes — it is
 * maintained in the same commit as the migrations, so a column change surfaces
 * here as a type error. This file only re-exports it and narrows the three
 * jsonb columns Dev 3 owns the shape of.
 */

export type {
  Badge,
  CompanyProfile,
  Json,
  Match,
  MatchStatus,
  Notification,
  PostingStatus,
  Profile,
  SandboxMode,
  SkillMatrix,
  SkillsJson,
  SmePosting,
  UserRole as Role,
} from "@/lib/types/database";

/**
 * Both sides of every threshold comparison use the frozen vocabulary. Dev 1's
 * mirror types these columns as Record<string, number>, which is correct for the
 * database but lets a typo through — and a mismatched key makes the match engine
 * silently return nothing rather than fail.
 */
export type ScoreMap = Partial<Record<CompetencyKey, number>>;

export type SandboxScore = Omit<DbSandboxScore, "scores_json"> & {
  scores_json: ScoreMap;
};

export type RoleSkillTemplate = Omit<DbRoleSkillTemplate, "thresholds_json"> & {
  thresholds_json: ScoreMap;
};

/** Dev 2 owns this shape. Never read unless reviewed_by_employee is true. */
export type RawInterview = {
  role_title?: string;
  recurring_tasks?: string[];
  tools?: string[];
  shortcuts?: string[];
  coordinates_with?: string[];
  notes?: string;
};

export type ContinuityBrief = Omit<DbContinuityBrief, "raw_interview_json"> & {
  raw_interview_json: RawInterview | null;
};

/**
 * Pillar 3b generated challenge content. The schema stores only
 * continuity_briefs.custom_node_id, with no table for the challenge body, and
 * asking Dev 1 for a new table under time pressure is the wrong trade. So the
 * body is cached here and can always be rebuilt from the reviewed brief.
 */
export type GeneratedChallenge = {
  node_id: string;
  posting_id: string;
  payload: unknown;
};
