import { gapAnalysis } from "@/lib/ai/gap-analysis";
import { repo } from "@/lib/data";
import { bestScores, groupScoresByUser } from "@/lib/data/derive";
import type { Profile } from "@/lib/data/types";
import {
  embedTexts,
  plannedSource,
  type EmbeddingSource,
} from "@/lib/matcher/embed";
import {
  candidateProfileText,
  roleProfileText,
} from "@/lib/matcher/profile-text";
import { evaluateThresholds, matchScore } from "@/lib/matcher/score";
import { semanticSignals } from "@/lib/matcher/semantic";

export type MatchRunResult = {
  postingId: string;
  templateName: string;
  /** Opted-in candidates considered, before the threshold gate. */
  considered: number;
  /** Candidates who cleared every threshold and now have a match row. */
  matched: number;
  /** Which embedding provider ranked this run. */
  embeddingSource: EmbeddingSource;
  /**
   * Candidate vectors actually stored. Lower than `matched` when a candidate
   * has no skill_matrices row, which is expected before Pillar 1 intake.
   */
  embeddingsStored: number;
};

function firstName(profile: Profile): string {
  return profile.full_name?.trim().split(/\s+/)[0] ?? "This candidate";
}

/**
 * Writes the run's vectors into the columns Section 3 specifies. Never fatal:
 * ranking already happened in memory, so a failed write costs the persistence
 * this run and nothing the SME can see.
 */
async function persistEmbeddings(
  postingId: string,
  roleVector: number[],
  candidates: { userId: string; vector: number[] }[],
): Promise<number> {
  let stored = 0;

  try {
    await repo().savePostingEmbedding(postingId, roleVector);
  } catch (error) {
    console.error("[matcher] could not store the posting vector", error);
  }

  for (const candidate of candidates) {
    try {
      if (await repo().saveCandidateEmbedding(candidate.userId, candidate.vector)) {
        stored += 1;
      }
    } catch (error) {
      console.error(
        `[matcher] could not store a vector for ${candidate.userId}`,
        error,
      );
    }
  }

  return stored;
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
      embeddingSource: plannedSource(),
      embeddingsStored: 0,
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
      embeddingSource: plannedSource(),
      embeddingsStored: 0,
    };
  }

  // Section 3's semantic layer. Role and candidates go through one call so they
  // share a provider and a calibration; mixing an OpenAI role vector with local
  // candidate vectors would produce similarity scores that mean nothing.
  //
  // Recomputed each run rather than read back from the columns: a candidate's
  // profile text is built from their scores, so a stored vector goes stale the
  // moment they complete another challenge.
  const { vectors, source } = await embedTexts([
    roleProfileText(posting, template),
    ...eligible.map((entry) =>
      candidateProfileText(entry.scores, entry.rows),
    ),
  ]);

  const [roleVector, ...candidateVectors] = vectors;

  const semantic = semanticSignals(
    roleVector,
    eligible.map((entry, index) => ({
      id: entry.candidate.id,
      vector: candidateVectors[index],
    })),
    source,
  );

  const persisted = await persistEmbeddings(
    posting.id,
    roleVector,
    eligible.map((entry, index) => ({
      userId: entry.candidate.id,
      vector: candidateVectors[index],
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
    embeddingSource: source,
    embeddingsStored: persisted,
  };
}
