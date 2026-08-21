import type {
  Badge,
  CompanyProfile,
  ContinuityBrief,
  GeneratedChallenge,
  Match,
  MatchStatus,
  Notification,
  Profile,
  RawInterview,
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

export type SkillMatrixInput = {
  user_id: string;
  skills_json: SkillMatrix["skills_json"];
  readiness_score: number;
};

export type BriefDraftInput = {
  posting_id: string;
  raw_interview_json: RawInterview;
  generated_brief: string;
};

/** Status without content, so a caller can branch without reading a brief. */
export type BriefStatus = {
  exists: boolean;
  reviewed: boolean;
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

  /**
   * Pillar 1's coach output. Through the seam rather than a direct insert, so
   * the offline demo can produce a skill map at all, and so the matcher reads
   * the coach's work from the same place in both modes.
   */
  saveSkillMatrix(input: SkillMatrixInput): Promise<SkillMatrix>;

  /**
   * pgvector persistence for Section 3's semantic search. Service role in
   * supabase mode: the match engine writes a candidate's vector, and a
   * candidate's skill_matrices row is not the SME's to touch.
   */
  savePostingEmbedding(postingId: string, vector: number[]): Promise<void>;
  /**
   * False when the candidate has no skill_matrices row yet, which is the normal
   * state for anyone who has done Sandbox challenges but not Dev 2's intake.
   * A missing row is skipped, never created — the matrix is Pillar 1's to write.
   */
  saveCandidateEmbedding(userId: string, vector: number[]): Promise<boolean>;

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

  /**
   * Every open transition role, across all companies. Readable by any signed-in
   * user under 0002's "sme_postings: authenticated read open" policy, which is
   * what lets the candidate's node tree list transition challenges without a
   * service-role read.
   */
  listOpenTransitionPostings(): Promise<SmePosting[]>;

  /**
   * Carries matches.candidate_label, which 0006 derives from a trigger: the
   * candidate's name only while they are discoverable, a stable "Candidate A"
   * otherwise. There is deliberately no read path onto profiles here.
   */
  listMatchesForPosting(postingId: string): Promise<Match[]>;
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

  /**
   * Whether a posting has a brief at all, and whether it has been approved.
   * Two booleans and nothing else, so the posting page can offer to start or
   * resume an interview without acquiring a read onto unreviewed content.
   */
  getBriefStatus(postingId: string): Promise<BriefStatus>;

  /**
   * The brief regardless of review state, for the redaction screen alone.
   *
   * 0002 makes an unreviewed brief invisible to everyone, the owning SME
   * included, because it may still name clients. The redaction UI is the one
   * place that cannot honour that and still function: somebody has to read the
   * unredacted text in order to redact it. 0002's own comment allows for this —
   * "the review step runs through a server route using the service role".
   *
   * Every other read stays reviewed-only. Callers must gate on posting
   * ownership themselves, since the service role will not do it for them.
   */
  getBriefDraft(postingId: string): Promise<ContinuityBrief | null>;

  /**
   * Writes the interview and its derived prose. Re-running the interview
   * overwrites the draft rather than stacking rows, since the brief is
   * one-per-posting.
   *
   * Always leaves the brief unapproved, including when it was approved a moment
   * ago. Approval is the redaction gate, so it can only ever be an explicit act
   * on text somebody has read — otherwise an edit after approval would ship
   * unreviewed prose under an approved flag.
   */
  saveBriefDraft(input: BriefDraftInput): Promise<ContinuityBrief>;

  /**
   * The redaction gate. `generated_brief` carries the employee's edits, so the
   * text that becomes visible is the text they actually approved.
   */
  setBriefReviewed(
    postingId: string,
    reviewed: boolean,
    generatedBrief?: string,
  ): Promise<void>;

  /**
   * Reviewed briefs only. An unreviewed brief is not returned in a partial or
   * redacted form — it is absent, so no caller can render one by forgetting a
   * check. Master checklist: "Continuity Briefs are unreachable until
   * reviewed_by_employee = true."
   */
  getBriefByPosting(postingId: string): Promise<ContinuityBrief | null>;
  /** Reviewed briefs only — never expose one pre-redaction (Section 9, point 4). */
  listReviewedBriefsBySme(smeId: string): Promise<ContinuityBrief[]>;
  setBriefCustomNode(briefId: string, nodeId: string): Promise<void>;

  /**
   * The reviewed brief behind a transition challenge, for challenge generation
   * only — never to render.
   *
   * 0002 scopes continuity_briefs to the owning SME, which is correct for the
   * brief but wrong for the challenge derived from it: the candidate replacing
   * the departing employee is precisely who the challenge is for, and they will
   * never own the posting. getBriefByPosting therefore returns null for them and
   * the challenge page 404s.
   *
   * So this reads past that policy, and is safe to only because of what it is
   * used for. reviewed_by_employee is still required, so the source has been
   * redacted; the caller returns a generated SandboxNode and never the brief
   * itself; and a candidate seeing the simulation of a job they are applying for
   * is the Section 2 point 4 feature, not a leak.
   */
  getReviewedBriefForChallenge(
    postingId: string,
  ): Promise<ContinuityBrief | null>;

  /**
   * A per-process memo for generated challenge bodies, which have no table in
   * Section 8's schema. Not storage: a miss must always be rebuildable, so there
   * is deliberately no "list everything cached" read — deriving a node tree from
   * one gives a different answer per instance.
   */
  getGeneratedChallenge(nodeId: string): Promise<GeneratedChallenge | null>;
  saveGeneratedChallenge(challenge: GeneratedChallenge): Promise<void>;
}
