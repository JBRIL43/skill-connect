/**
 * Hand-maintained mirror of supabase/migrations. Dev 1 updates this in the same
 * commit as any migration change, so a column rename shows up as a type error
 * rather than a runtime surprise at hour 40.
 */

export type UserRole = "job_seeker" | "sme" | "admin";
export type SandboxMode = "standard" | "pressure_simulation";
export type PostingStatus = "open" | "filled";
export type MatchStatus = "suggested" | "shortlisted" | "hired";
export type PaymentProvider = "telebirr" | "chapa" | "mock";
export type PaymentStatus = "pending" | "paid";

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json }
  | Json[];

/** Shape Dev 2's intake coach writes to skill_matrices.skills_json. */
export type SkillsJson = {
  technical?: Record<string, number>;
  human?: Record<string, number>;
  raw_notes?: string;
};

/** Shape Dev 3's grader writes to sandbox_scores.scores_json. */
export type ScoresJson = Record<string, number>;

/** Shape Dev 3's template builder writes to role_skill_templates.thresholds_json. */
export type ThresholdsJson = Record<string, number>;

export type Profile = {
  id: string;
  role: UserRole;
  full_name: string | null;
  bio: string | null;
  phone: string | null;
  region: string | null;
  opt_in_discoverable: boolean;
  is_seed: boolean;
  created_at: string;
};

export type CompanyProfile = {
  id: string;
  sme_id: string;
  company_name: string;
  industry: string | null;
  size: string | null;
  logo_url: string | null;
  about: string | null;
  verified: boolean;
  created_at: string;
};

export type SkillMatrix = {
  id: string;
  user_id: string;
  skills_json: SkillsJson;
  readiness_score: number | null;
  embedding: number[] | null;
  created_at: string;
};

export type SandboxScore = {
  id: string;
  user_id: string;
  node_id: string;
  scores_json: ScoresJson;
  mode: SandboxMode;
  completed_at: string;
};

export type Badge = {
  id: string;
  user_id: string;
  node_id: string;
  badge_name: string;
  awarded_at: string;
};

export type RoleSkillTemplate = {
  id: string;
  sme_id: string;
  role_name: string;
  thresholds_json: ThresholdsJson;
  notify_on_match: boolean;
  created_at: string;
};

export type SmePosting = {
  id: string;
  sme_id: string;
  template_id: string | null;
  description: string | null;
  embedding: number[] | null;
  is_transition_role: boolean;
  status: PostingStatus;
  created_at: string;
};

export type ContinuityBrief = {
  id: string;
  posting_id: string;
  raw_interview_json: Json | null;
  generated_brief: string | null;
  custom_node_id: string | null;
  reviewed_by_employee: boolean;
  created_at: string;
};

export type Match = {
  id: string;
  posting_id: string;
  candidate_id: string;
  match_score: number | null;
  gap_analysis: string | null;
  status: MatchStatus;
  /**
   * How the ranked-results screen labels this row. The candidate's real name
   * while they are discoverable, otherwise their anonymous_label. Assigned by a
   * trigger (migration 0006) because an SME cannot read a candidate's profile --
   * render it as-is rather than joining to profiles, which will return nothing.
   */
  candidate_label: string | null;
  /** "Candidate A" style fallback, stable per posting even across an opt-out. */
  anonymous_label: string | null;
  created_at: string;
};

export type Notification = {
  id: string;
  sme_id: string;
  template_id: string;
  candidate_id: string;
  seen: boolean;
  created_at: string;
};

export type Payment = {
  id: string;
  sme_id: string;
  provider: PaymentProvider;
  amount: number;
  status: PaymentStatus;
  created_at: string;
};
