import { gapAnalysis } from "@/lib/ai/gap-analysis";
import { repo } from "@/lib/data";
import { bestScores, groupScoresByUser } from "@/lib/data/derive";
import type { Profile, RoleSkillTemplate, SmePosting } from "@/lib/data/types";
import { evaluateThresholds, matchScore } from "@/lib/matcher/score";
import { semanticSignals } from "@/lib/matcher/semantic";

export type MatchRunResult = {
  postingId: string;
  templateName: string;
  /** Opted-in candidates considered, before the threshold gate. */
  considered: number;
  /** Candidates who cleared every threshold and now have a match row. */
  matched: number;
};

function firstName(profile: Profile): string {
  return profile.full_name?.trim().split(/\s+/)[0] ?? "This candidate";
}

function roleText(posting: SmePosting, template: RoleSkillTemplate): string {
  return [template.role_name, posting.description ?? ""].join(". ");
}

/**
 * The match run. Section 2, point 2: eligibility is a hard gate on verified
 * Sandbox Scores, so a candidate who misses one threshold does not appear at a
 * lower rank — they do not appear at all.
 *
 * Reads candidates' scores through the service role, because an SME has no
 * policy on sandbox_scores and would otherwise get zero rows rather than an
 * error. Writes matches on the caller's session, where owns_posting() applies.
 */
export async function runMatch(postingId: string): Promise<MatchRunResult> {
  const posting = await repo().getPosting(postingId);
  if (!posting) throw new Error(`Unknown posting ${postingId}`);
  if (!posting.template_id) {
    throw new Error("This posting has no Role Skill Template attached.");
  }

  const template = await repo().getTemplate(posting.template_id);
  if (!template) throw new Error("The posting's template no longer exists.");

  // Section 9, point 2: the opt-in filter is the entire candidate pool, not a
  // display filter applied afterwards.
  const candidates = await repo().listOptedInCandidates();

  if (candidates.length === 0) {
    return {
      postingId,
      templateName: template.role_name,
      considered: 0,
      matched: 0,
    };
  }

  const scoresByUser = groupScoresByUser(
    await repo().listScoresForUsers(candidates.map((row) => row.id)),
  );

  const eligible = candidates
    .map((candidate) => {
      const rows = scoresByUser.get(candidate.id) ?? [];
      const scores = bestScores(rows);
      return {
        candidate,
        scores,
        rows,
        check: evaluateThresholds(scores, template.thresholds_json),
      };
    })
    .filter((entry) => entry.check.clears);

  if (eligible.length === 0) {
    return {
      postingId,
      templateName: template.role_name,
      considered: candidates.length,
      matched: 0,
    };
  }

  // Additive only, and degrades to token overlap without an API key, so ranking
  // never depends on the embedding call succeeding.
  const semantic = await semanticSignals(
    roleText(posting, template),
    eligible.map((entry) => ({
      id: entry.candidate.id,
      text: [entry.candidate.bio ?? "", entry.candidate.region ?? ""].join(" "),
    })),
  );

  for (const entry of eligible) {
    const score = matchScore({
      check: entry.check,
      semantic: semantic.get(entry.candidate.id) ?? 0,
      verifiedChallenges: new Set(entry.rows.map((row) => row.node_id)).size,
    });

    const analysis = await gapAnalysis({
      candidateFirstName: firstName(entry.candidate),
      roleName: template.role_name,
      scores: entry.scores,
      thresholds: template.thresholds_json,
    });

    await repo().upsertMatch({
      posting_id: posting.id,
      candidate_id: entry.candidate.id,
      match_score: score,
      gap_analysis: analysis,
    });
  }

  return {
    postingId,
    templateName: template.role_name,
    considered: candidates.length,
    matched: eligible.length,
  };
}
