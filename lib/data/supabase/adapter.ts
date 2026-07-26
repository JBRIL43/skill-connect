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
  CompanyProfile,
  ContinuityBrief,
  GeneratedChallenge,
  Match,
  MatchStatus,
  Notification,
  Profile,
  Role,
  RoleSkillTemplate,
  SandboxScore,
  SkillMatrix,
  SmePosting,
} from "@/lib/data/types";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * Two clients, chosen per operation, because 0002_rls_policies.sql denies rather
 * than errors. Read the wrong way and you get an empty array that looks exactly
 * like a scoring bug.
 *
 * `db()` carries the caller's session and runs under their policies. Use it for
 * anything the signed-in user owns.
 *
 * `elevated()` bypasses RLS. Only the three cross-user operations need it: the
 * notification check reads every SME's templates, the match run reads other
 * users' scores, and continuity_briefs has no write policy at all.
 */
function db() {
  return createClient();
}

function elevated() {
  return createAdminClient();
}

function unwrap<T>(result: {
  data: T | null;
  error: { message: string } | null;
}): T | null {
  if (result.error) throw new Error(result.error.message);
  return result.data;
}

function unwrapList<T>(result: {
  data: T[] | null;
  error: { message: string } | null;
}): T[] {
  if (result.error) throw new Error(result.error.message);
  return result.data ?? [];
}

/**
 * Pillar 3b generated challenge bodies. Section 8's flat schema stores only
 * continuity_briefs.custom_node_id and has no table for the challenge itself.
 * Rather than ask Dev 1 for a migration late in the build, the body is cached
 * per process and rebuilt from the reviewed brief when the cache is cold.
 */
const generatedChallenges = new Map<string, GeneratedChallenge>();

export const supabaseRepository: DataRepository = {
  kind: "supabase",

  async getProfile(profileId) {
    return unwrap<Profile>(
      await (await db())
        .from("profiles")
        .select("*")
        .eq("id", profileId)
        .maybeSingle(),
    );
  },

  // Cross-user: profiles is own-row only for non-admins.
  async listProfiles(role?: Role) {
    const query = elevated().from("profiles").select("*");
    return unwrapList<Profile>(await (role ? query.eq("role", role) : query));
  },

  // Cross-user: the match engine's candidate pool.
  async listOptedInCandidates() {
    return unwrapList<Profile>(
      await elevated()
        .from("profiles")
        .select("*")
        .eq("role", "job_seeker")
        .eq("opt_in_discoverable", true),
    );
  },

  async setOptInDiscoverable(userId, value) {
    const { error } = await (await db())
      .from("profiles")
      .update({ opt_in_discoverable: value })
      .eq("id", userId);
    if (error) throw new Error(error.message);
  },

  async listCompanyProfiles() {
    return unwrapList<CompanyProfile>(
      await (await db()).from("company_profiles").select("*"),
    );
  },

  async getCompanyProfile(companyId) {
    return unwrap<CompanyProfile>(
      await (await db())
        .from("company_profiles")
        .select("*")
        .eq("id", companyId)
        .maybeSingle(),
    );
  },

  async getCompanyProfileBySme(smeId) {
    return unwrap<CompanyProfile>(
      await (await db())
        .from("company_profiles")
        .select("*")
        .eq("sme_id", smeId)
        .maybeSingle(),
    );
  },

  async updateCompanyProfile(companyId, patch: CompanyProfilePatch) {
    return unwrap<CompanyProfile>(
      await (await db())
        .from("company_profiles")
        .update(patch)
        .eq("id", companyId)
        .select("*")
        .maybeSingle(),
    );
  },

  async getSkillMatrix(userId) {
    return unwrap<SkillMatrix>(
      await (await db())
        .from("skill_matrices")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    );
  },

  async savePostingEmbedding(postingId, vector) {
    // The SME owns the posting, but 0005 does not grant them the embedding
    // column, and the vector is engine output rather than something they typed.
    const { error } = await elevated()
      .from("sme_postings")
      .update({ embedding: vector })
      .eq("id", postingId);

    if (error) throw new Error(error.message);
  },

  async saveCandidateEmbedding(userId, vector) {
    const existing = unwrap<{ id: string }>(
      await elevated()
        .from("skill_matrices")
        .select("id")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    );

    if (!existing) return false;

    const { error } = await elevated()
      .from("skill_matrices")
      .update({ embedding: vector })
      .eq("id", existing.id);

    if (error) throw new Error(error.message);
    return true;
  },

  async listSandboxScores(userId) {
    return unwrapList<SandboxScore>(
      await (await db())
        .from("sandbox_scores")
        .select("*")
        .eq("user_id", userId)
        .order("completed_at", { ascending: false }),
    );
  },

  // Cross-user: an SME has no policy on sandbox_scores at all, by design.
  async listScoresForUsers(userIds) {
    if (userIds.length === 0) return [];
    return unwrapList<SandboxScore>(
      await elevated().from("sandbox_scores").select("*").in("user_id", userIds),
    );
  },

  async saveSandboxScore(input: SandboxScoreInput) {
    const row = unwrap<SandboxScore>(
      await (await db())
        .from("sandbox_scores")
        .insert({ ...input, completed_at: new Date().toISOString() })
        .select("*")
        .single(),
    );
    if (!row) throw new Error("sandbox_scores insert returned no row");
    return row;
  },

  async listBadges(userId) {
    return unwrapList<Badge>(
      await (await db()).from("badges").select("*").eq("user_id", userId),
    );
  },

  async awardBadge(input: BadgeInput) {
    const client = await db();

    // badges is unique (user_id, node_id): re-grading the same challenge must
    // return the existing badge rather than raise a conflict.
    const existing = unwrap<Badge>(
      await client
        .from("badges")
        .select("*")
        .eq("user_id", input.user_id)
        .eq("node_id", input.node_id)
        .maybeSingle(),
    );
    if (existing) return existing;

    const row = unwrap<Badge>(
      await client
        .from("badges")
        .insert({ ...input, awarded_at: new Date().toISOString() })
        .select("*")
        .single(),
    );
    if (!row) throw new Error("badges insert returned no row");
    return row;
  },

  async listTemplates(smeId) {
    return unwrapList<RoleSkillTemplate>(
      await (await db())
        .from("role_skill_templates")
        .select("*")
        .eq("sme_id", smeId)
        .order("created_at", { ascending: false }),
    );
  },

  // Cross-user: the notification check compares one candidate against every
  // SME's thresholds, and a job seeker has no read on this table.
  async listNotifyTemplates() {
    return unwrapList<RoleSkillTemplate>(
      await elevated()
        .from("role_skill_templates")
        .select("*")
        .eq("notify_on_match", true),
    );
  },

  async getTemplate(templateId) {
    return unwrap<RoleSkillTemplate>(
      await (await db())
        .from("role_skill_templates")
        .select("*")
        .eq("id", templateId)
        .maybeSingle(),
    );
  },

  async createTemplate(input: TemplateInput) {
    const row = unwrap<RoleSkillTemplate>(
      await (await db())
        .from("role_skill_templates")
        .insert(input)
        .select("*")
        .single(),
    );
    if (!row) throw new Error("role_skill_templates insert returned no row");
    return row;
  },

  async listPostings(smeId) {
    return unwrapList<SmePosting>(
      await (await db()).from("sme_postings").select("*").eq("sme_id", smeId),
    );
  },

  async getPosting(postingId) {
    return unwrap<SmePosting>(
      await (await db())
        .from("sme_postings")
        .select("*")
        .eq("id", postingId)
        .maybeSingle(),
    );
  },

  // Session client: 0002 lets any authenticated user read an open posting, so a
  // candidate can enumerate transition roles without elevation.
  async listOpenTransitionPostings() {
    return unwrapList<SmePosting>(
      await (await db())
        .from("sme_postings")
        .select("*")
        .eq("is_transition_role", true)
        .eq("status", "open"),
    );
  },

  async getPostingByTemplate(templateId) {
    return unwrap<SmePosting>(
      await (await db())
        .from("sme_postings")
        .select("*")
        .eq("template_id", templateId)
        .maybeSingle(),
    );
  },

  async listMatchesForPosting(postingId) {
    // Derived columns only. A candidate's skill matrix is never joined in here
    // (Section 9, point 1) — RLS is the second layer, not the only one.
    // candidate_label is derived too: 0006 writes it from a trigger, so reading
    // it here is not a read path onto profiles.
    return unwrapList<Match>(
      await (await db())
        .from("matches")
        .select(
          "id, posting_id, candidate_id, match_score, gap_analysis, status, created_at, candidate_label, anonymous_label",
        )
        .eq("posting_id", postingId)
        .order("match_score", { ascending: false }),
    );
  },

  // Service role, because 0005 revokes update on matches from authenticated and
  // grants back only `status`. match_score and gap_analysis are the engine's
  // output and are deliberately not the caller's to write — the same reason the
  // scoring reads are elevated. Ownership is enforced by the action that calls
  // this, not by RLS, so runMatch must stay behind requireOwnedPosting.
  async upsertMatch(input: MatchInput) {
    const client = elevated();

    const existing = unwrap<Match>(
      await client
        .from("matches")
        .select("*")
        .eq("posting_id", input.posting_id)
        .eq("candidate_id", input.candidate_id)
        .maybeSingle(),
    );

    if (existing) {
      const updated = unwrap<Match>(
        await client
          .from("matches")
          .update({
            match_score: input.match_score,
            gap_analysis: input.gap_analysis,
          })
          .eq("id", existing.id)
          .select("*")
          .single(),
      );
      if (!updated) throw new Error("matches update returned no row");
      return updated;
    }

    const row = unwrap<Match>(
      await client
        .from("matches")
        .insert({ ...input, status: "suggested" })
        .select("*")
        .single(),
    );
    if (!row) throw new Error("matches insert returned no row");
    return row;
  },

  // Stays on the caller's session: `status` is the one column 0005 grants an
  // SME, and owns_posting() keeps them to their own postings.
  async setMatchStatus(matchId, status: MatchStatus) {
    return unwrap<Match>(
      await (await db())
        .from("matches")
        .update({ status })
        .eq("id", matchId)
        .select("*")
        .maybeSingle(),
    );
  },

  async countHiredBySme(smeId) {
    // Company profiles are public, so the hired count on a public page has to be
    // readable by a visitor who owns none of these postings.
    const client = elevated();

    const postings = unwrapList<{ id: string }>(
      await client.from("sme_postings").select("id").eq("sme_id", smeId),
    );
    if (postings.length === 0) return 0;

    const { count, error } = await client
      .from("matches")
      .select("id", { count: "exact", head: true })
      .in(
        "posting_id",
        postings.map((row) => row.id),
      )
      .eq("status", "hired");

    if (error) throw new Error(error.message);
    return count ?? 0;
  },

  async listNotifications(smeId) {
    return unwrapList<Notification>(
      await (await db())
        .from("notifications")
        .select("*")
        .eq("sme_id", smeId)
        .order("created_at", { ascending: false }),
    );
  },

  // Cross-user: notifications has no insert policy, deliberately.
  async createNotificationIfNew(input) {
    const client = elevated();

    const existing = unwrap<Notification>(
      await client
        .from("notifications")
        .select("*")
        .eq("sme_id", input.sme_id)
        .eq("template_id", input.template_id)
        .eq("candidate_id", input.candidate_id)
        .maybeSingle(),
    );
    if (existing) return null;

    return unwrap<Notification>(
      await client
        .from("notifications")
        .insert({ ...input, seen: false })
        .select("*")
        .maybeSingle(),
    );
  },

  async markNotificationSeen(notificationId) {
    const { error } = await (await db())
      .from("notifications")
      .update({ seen: true })
      .eq("id", notificationId);
    if (error) throw new Error(error.message);
  },

  async getBriefByPosting(postingId) {
    return unwrap<ContinuityBrief>(
      await (await db())
        .from("continuity_briefs")
        .select("*")
        .eq("posting_id", postingId)
        .eq("reviewed_by_employee", true)
        .maybeSingle(),
    );
  },

  // Elevated on purpose, and the reasoning is on the interface. Still reviewed-only:
  // the filter is the redaction guarantee, not the ownership check.
  async getReviewedBriefForChallenge(postingId) {
    return unwrap<ContinuityBrief>(
      await elevated()
        .from("continuity_briefs")
        .select("*")
        .eq("posting_id", postingId)
        .eq("reviewed_by_employee", true)
        .maybeSingle(),
    );
  },

  async listReviewedBriefsBySme(smeId) {
    const client = await db();

    const postings = unwrapList<{ id: string }>(
      await client.from("sme_postings").select("id").eq("sme_id", smeId),
    );
    if (postings.length === 0) return [];

    return unwrapList<ContinuityBrief>(
      await client
        .from("continuity_briefs")
        .select("*")
        .eq("reviewed_by_employee", true)
        .in(
          "posting_id",
          postings.map((row) => row.id),
        ),
    );
  },

  // Two booleans, selected without the content columns, so this cannot become
  // an accidental read path onto an unreviewed brief.
  async getBriefStatus(postingId) {
    const row = unwrap<{ reviewed_by_employee: boolean }>(
      await elevated()
        .from("continuity_briefs")
        .select("reviewed_by_employee")
        .eq("posting_id", postingId)
        .maybeSingle(),
    );

    return { exists: Boolean(row), reviewed: Boolean(row?.reviewed_by_employee) };
  },

  // Reads pre-redaction content. Only the redaction screen may call this, and
  // only after checking the caller owns the posting — see the interface note.
  async getBriefDraft(postingId) {
    return unwrap<ContinuityBrief>(
      await elevated()
        .from("continuity_briefs")
        .select("*")
        .eq("posting_id", postingId)
        .maybeSingle(),
    );
  },

  // Elevated for the same reason as every other write here: the table has no
  // write policy, and the outgoing employee is not necessarily an account.
  async saveBriefDraft(input) {
    const existing = unwrap<{ id: string }>(
      await elevated()
        .from("continuity_briefs")
        .select("id")
        .eq("posting_id", input.posting_id)
        .maybeSingle(),
    );

    // reviewed_by_employee is forced false rather than left alone: an edit to
    // an approved brief has not itself been approved.
    const payload = {
      posting_id: input.posting_id,
      raw_interview_json: input.raw_interview_json,
      generated_brief: input.generated_brief,
      reviewed_by_employee: false,
    };

    const written = existing
      ? await elevated()
          .from("continuity_briefs")
          .update(payload)
          .eq("id", existing.id)
          .select("*")
          .single()
      : await elevated()
          .from("continuity_briefs")
          .insert(payload)
          .select("*")
          .single();

    if (written.error) throw new Error(written.error.message);
    return written.data as ContinuityBrief;
  },

  async setBriefReviewed(postingId, reviewed, generatedBrief) {
    const patch: Record<string, unknown> = { reviewed_by_employee: reviewed };
    if (generatedBrief !== undefined) patch.generated_brief = generatedBrief;

    const { error } = await elevated()
      .from("continuity_briefs")
      .update(patch)
      .eq("posting_id", postingId);
    if (error) throw new Error(error.message);
  },

  // Cross-user: continuity_briefs has no write policy for anyone.
  async setBriefCustomNode(briefId, nodeId) {
    const { error } = await elevated()
      .from("continuity_briefs")
      .update({ custom_node_id: nodeId })
      .eq("id", briefId);
    if (error) throw new Error(error.message);
  },

  async getGeneratedChallenge(nodeId) {
    return generatedChallenges.get(nodeId) ?? null;
  },

  async saveGeneratedChallenge(challenge: GeneratedChallenge) {
    generatedChallenges.set(challenge.node_id, challenge);
  },
};
