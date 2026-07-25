import { store } from "@/lib/data/mock/store";
import type {
  BadgeInput,
  CompanyProfilePatch,
  DataRepository,
  MatchInput,
  SandboxScoreInput,
  TemplateInput,
} from "@/lib/data/repository";
import type {
  Badge,
  GeneratedChallenge,
  Match,
  MatchStatus,
  Notification,
  Role,
  RoleSkillTemplate,
  SandboxScore,
} from "@/lib/data/types";

const now = () => new Date().toISOString();
const id = (prefix: string) => `${prefix}-${crypto.randomUUID().slice(0, 8)}`;

export const mockRepository: DataRepository = {
  kind: "mock",

  async getProfile(profileId) {
    return store().profiles.find((row) => row.id === profileId) ?? null;
  },

  async listProfiles(role?: Role) {
    const rows = store().profiles;
    return role ? rows.filter((row) => row.role === role) : rows;
  },

  async listOptedInCandidates() {
    return store().profiles.filter(
      (row) => row.role === "job_seeker" && row.opt_in_discoverable,
    );
  },

  async setOptInDiscoverable(userId, value) {
    const profile = store().profiles.find((row) => row.id === userId);
    if (profile) profile.opt_in_discoverable = value;
  },

  async listCompanyProfiles() {
    return store().companyProfiles;
  },

  async getCompanyProfile(companyId) {
    return (
      store().companyProfiles.find((row) => row.id === companyId) ?? null
    );
  },

  async getCompanyProfileBySme(smeId) {
    return store().companyProfiles.find((row) => row.sme_id === smeId) ?? null;
  },

  async updateCompanyProfile(companyId, patch: CompanyProfilePatch) {
    const row = store().companyProfiles.find((item) => item.id === companyId);
    if (!row) return null;
    Object.assign(row, patch);
    return row;
  },

  async getSkillMatrix(userId) {
    return store().skillMatrices.find((row) => row.user_id === userId) ?? null;
  },

  async listSandboxScores(userId) {
    return store()
      .sandboxScores.filter((row) => row.user_id === userId)
      .sort((a, b) => b.completed_at.localeCompare(a.completed_at));
  },

  async listScoresForUsers(userIds) {
    const wanted = new Set(userIds);
    return store().sandboxScores.filter((row) => wanted.has(row.user_id));
  },

  async saveSandboxScore(input: SandboxScoreInput) {
    const row: SandboxScore = {
      id: id("score"),
      completed_at: now(),
      ...input,
    };
    store().sandboxScores.push(row);
    return row;
  },

  async listBadges(userId) {
    return store().badges.filter((row) => row.user_id === userId);
  },

  async awardBadge(input: BadgeInput) {
    const existing = store().badges.find(
      (row) => row.user_id === input.user_id && row.node_id === input.node_id,
    );
    if (existing) return existing;

    const row: Badge = { id: id("badge"), awarded_at: now(), ...input };
    store().badges.push(row);
    return row;
  },

  async listTemplates(smeId) {
    return store()
      .templates.filter((row) => row.sme_id === smeId)
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  },

  async listNotifyTemplates() {
    return store().templates.filter((row) => row.notify_on_match);
  },

  async getTemplate(templateId) {
    return store().templates.find((row) => row.id === templateId) ?? null;
  },

  async createTemplate(input: TemplateInput) {
    const row: RoleSkillTemplate = {
      id: id("tpl"),
      created_at: now(),
      ...input,
    };
    store().templates.push(row);
    return row;
  },

  async listPostings(smeId) {
    return store().postings.filter((row) => row.sme_id === smeId);
  },

  async getPosting(postingId) {
    return store().postings.find((row) => row.id === postingId) ?? null;
  },

  async getPostingByTemplate(templateId) {
    return (
      store().postings.find((row) => row.template_id === templateId) ?? null
    );
  },

  async listMatchesForPosting(postingId) {
    return store()
      .matches.filter((row) => row.posting_id === postingId)
      .sort((a, b) => (b.match_score ?? 0) - (a.match_score ?? 0));
  },

  async upsertMatch(input: MatchInput) {
    const existing = store().matches.find(
      (row) =>
        row.posting_id === input.posting_id &&
        row.candidate_id === input.candidate_id,
    );

    if (existing) {
      existing.match_score = input.match_score;
      existing.gap_analysis = input.gap_analysis;
      return existing;
    }

    const row: Match = {
      id: id("match"),
      status: "suggested",
      created_at: new Date().toISOString(),
      ...input,
    };
    store().matches.push(row);
    return row;
  },

  async setMatchStatus(matchId, status: MatchStatus) {
    const row = store().matches.find((item) => item.id === matchId);
    if (!row) return null;
    row.status = status;
    return row;
  },

  async countHiredBySme(smeId) {
    const postingIds = new Set(
      store()
        .postings.filter((row) => row.sme_id === smeId)
        .map((row) => row.id),
    );
    return store().matches.filter(
      (row) => postingIds.has(row.posting_id) && row.status === "hired",
    ).length;
  },

  async listNotifications(smeId) {
    return store()
      .notifications.filter((row) => row.sme_id === smeId)
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  },

  async createNotificationIfNew(input) {
    const duplicate = store().notifications.find(
      (row) =>
        row.sme_id === input.sme_id &&
        row.template_id === input.template_id &&
        row.candidate_id === input.candidate_id,
    );
    if (duplicate) return null;

    const row: Notification = {
      id: id("note"),
      seen: false,
      created_at: now(),
      ...input,
    };
    store().notifications.push(row);
    return row;
  },

  async markNotificationSeen(notificationId) {
    const row = store().notifications.find((item) => item.id === notificationId);
    if (row) row.seen = true;
  },

  async getBriefByPosting(postingId) {
    return (
      store().continuityBriefs.find((row) => row.posting_id === postingId) ??
      null
    );
  },

  async listReviewedBriefsBySme(smeId) {
    const postingIds = new Set(
      store()
        .postings.filter((row) => row.sme_id === smeId)
        .map((row) => row.id),
    );
    return store().continuityBriefs.filter(
      (row) => row.reviewed_by_employee && postingIds.has(row.posting_id),
    );
  },

  async setBriefCustomNode(briefId, nodeId) {
    const row = store().continuityBriefs.find((item) => item.id === briefId);
    if (row) row.custom_node_id = nodeId;
  },

  async getGeneratedChallenge(nodeId) {
    return (
      store().generatedChallenges.find((row) => row.node_id === nodeId) ?? null
    );
  },

  async listGeneratedChallenges() {
    return store().generatedChallenges;
  },

  async saveGeneratedChallenge(challenge: GeneratedChallenge) {
    const rows = store().generatedChallenges;
    const index = rows.findIndex((row) => row.node_id === challenge.node_id);
    if (index >= 0) rows[index] = challenge;
    else rows.push(challenge);
  },
};
