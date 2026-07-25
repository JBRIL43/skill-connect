import { cosineSimilarity, embedMany } from "ai";
import { openai } from "@ai-sdk/openai";

import { isLiveAI } from "@/lib/ai/provider";
import { tokens } from "@/lib/ai/text-signals";

export type SemanticCandidate = { id: string; text: string };

/**
 * Semantic layer of the match engine. Section 3 specifies pgvector for
 * SME-to-talent similarity; this computes the same signal with the Vercel AI
 * SDK's embedding API in memory, which avoids asking Dev 1 for a vector column
 * mid-build. Persisting these vectors into pgvector is the follow-up once the
 * schema is live — the ranking contract does not change.
 *
 * Similarity is additive only (10 of 100 Match Score points), so an offline or
 * rate-limited run still ranks candidates on verified scores.
 */
export async function semanticSignals(
  roleText: string,
  candidates: SemanticCandidate[],
): Promise<Map<string, number>> {
  if (candidates.length === 0) return new Map();

  if (isLiveAI()) {
    try {
      const { embeddings } = await embedMany({
        model: openai.textEmbeddingModel(
          process.env.AI_EMBEDDING_MODEL ?? "text-embedding-3-small",
        ),
        values: [roleText, ...candidates.map((candidate) => candidate.text)],
      });

      const [roleVector, ...candidateVectors] = embeddings;
      const signals = new Map<string, number>();

      candidates.forEach((candidate, index) => {
        const raw = cosineSimilarity(roleVector, candidateVectors[index]);
        // Text embeddings cluster tightly; stretch the useful band to 0-1.
        signals.set(candidate.id, clamp01((raw - 0.6) / 0.3));
      });

      return signals;
    } catch (error) {
      console.error("[semantic] embedding call failed, using token overlap", error);
    }
  }

  return tokenOverlapSignals(roleText, candidates);
}

/** Deterministic fallback: Jaccard overlap of distinctive words. */
export function tokenOverlapSignals(
  roleText: string,
  candidates: SemanticCandidate[],
): Map<string, number> {
  const roleTokens = new Set(tokens(roleText));
  const signals = new Map<string, number>();

  for (const candidate of candidates) {
    const candidateTokens = new Set(tokens(candidate.text));
    if (roleTokens.size === 0 || candidateTokens.size === 0) {
      signals.set(candidate.id, 0);
      continue;
    }

    let shared = 0;
    for (const token of candidateTokens) {
      if (roleTokens.has(token)) shared += 1;
    }

    const union = roleTokens.size + candidateTokens.size - shared;
    signals.set(candidate.id, clamp01((shared / union) * 3));
  }

  return signals;
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}
