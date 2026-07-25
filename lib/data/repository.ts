import type {
  Badge,
  CompanyProfile,
  ContinuityBrief,
  GeneratedChallenge,
  Match,
  MatchStatus,
  Notification,
  Profile,
  Role,
  RoleSkillTemplate,
  SandboxMode,
  SandboxScore,
  ScoreMap,
  SkillMatrix,
  SmePosting,
} from "@/lib/data/types";

export type SandboxScoreInput = {
  user_id: string;
  node_id: string;
  scores_json: ScoreMap;
  mode: SandboxMode;
};

export type BadgeInput = {
  user_id: string;
  node_id: string;
  badge_name: string;
};

export type TemplateInput = {
  sme_id: string;
  role_name: string;
  thresholds_json: ScoreMap;
  notify_on_match: boolean;
};

export type MatchInput = {
  posting_id: string;
  candidate_id: string;
  match_score: number;
  gap_analysis: string;
};

export type CompanyProfilePatch = Partial<
  Pick<
    CompanyProfile,
    "company_name" | "industry" | "size" | "about" | "logo_url"
  >
>;

/**
 * The only identifying fields an SME ever sees about a candidate, and only for
 * candidates they already have a match with who opted in — the same condition
 * Dev 1's sme_has_match_with() uses to release badges.
 */
export type CandidateLabel = {
  id: string;
  full_name: string | null;
  region: string | null;
};

/**
 * The only surface Dev 3's routes and components are allowed to talk to.
 * Two implementations: `mock` (in-memory fixtures) and `supabase` (Dev 1's
 * live schema). Chosen by NEXT_PUBLIC_DATA_SOURCE.
 */
export interface DataRepository {
  readonly kind: "mock" | "supabase";

  getProfile(id: string): Promise<Profile | null>;
  listProfiles(role?: Role): Promise<Profile[]>;
  /** Section 9's opt-in rule: the only candidates the match engine may consider. */
  listOptedInCandidates(): Promise<Profile[]>;
  setOptInDiscoverable(userId: string, value: boolean): Promise<void>;

  listCompanyProfiles(): Promise<CompanyProfile[]>;
  getCompanyProfile(id: string): Promise<CompanyProfile | null>;
  getCompanyProfileBySme(smeId: string): Promise<CompanyProfile | null>;
  updateCompanyProfile(
    id: string,
    patch: CompanyProfilePatch,
  ): Promise<CompanyProfile | null>;

  getSkillMatrix(userId: string): Promise<SkillMatrix | null>;

  listSandboxScores(userId: string): Promise<SandboxScore[]>;
  listScoresForUsers(userIds: string[]): Promise<SandboxScore[]>;
  saveSandboxScore(input: SandboxScoreInput): Promise<SandboxScore>;
  listBadges(userId: string): Promise<Badge[]>;
  awardBadge(input: BadgeInput): Promise<Badge>;

  listTemplates(smeId: string): Promise<RoleSkillTemplate[]>;
  /** Every template with notify_on_match set — the notification check's input. */
  listNotifyTemplates(): Promise<RoleSkillTemplate[]>;
  getTemplate(id: string): Promise<RoleSkillTemplate | null>;
  createTemplate(input: TemplateInput): Promise<RoleSkillTemplate>;

  listPostings(smeId: string): Promise<SmePosting[]>;
  getPosting(id: string): Promise<SmePosting | null>;
  getPostingByTemplate(templateId: string): Promise<SmePosting | null>;

  listMatchesForPosting(postingId: string): Promise<Match[]>;
  /** Gated on the SME owning the posting and the candidate still opting in. */
  listCandidateLabelsForPosting(
    postingId: string,
    smeId: string,
  ): Promise<CandidateLabel[]>;
  upsertMatch(input: MatchInput): Promise<Match>;
  setMatchStatus(id: string, status: MatchStatus): Promise<Match | null>;
  countHiredBySme(smeId: string): Promise<number>;

  listNotifications(smeId: string): Promise<Notification[]>;
  createNotificationIfNew(input: {
    sme_id: string;
    template_id: string;
    candidate_id: string;
  }): Promise<Notification | null>;
  markNotificationSeen(id: string): Promise<void>;

  getBriefByPosting(postingId: string): Promise<ContinuityBrief | null>;
  /** Reviewed briefs only — never expose one pre-redaction (Section 9, point 4). */
  listReviewedBriefsBySme(smeId: string): Promise<ContinuityBrief[]>;
  setBriefCustomNode(briefId: string, nodeId: string): Promise<void>;

  getGeneratedChallenge(nodeId: string): Promise<GeneratedChallenge | null>;
  listGeneratedChallenges(): Promise<GeneratedChallenge[]>;
  saveGeneratedChallenge(challenge: GeneratedChallenge): Promise<void>;
}
