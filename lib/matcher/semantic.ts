import { cosine, type EmbeddingSource } from "@/lib/matcher/embed";

export type SemanticCandidate = { id: string; vector: number[] };

/**
 * Turns raw cosine similarity into the 0-1 signal Match Score consumes.
 *
 * The two providers need different calibration, which is the one place the
 * swap is not free. Sentence embeddings from OpenAI sit in a narrow high band —
 * almost any two pieces of English text score above 0.6 — so the useful range
 * has to be stretched. The local hashed vectors are sparse and near-orthogonal
 * for unrelated text, so overlap has to be amplified instead.
 *
 * Additive only: 10 of 100 Match Score points, per lib/matcher/score.ts. A
 * miscalibrated band moves candidates a few points, it does not decide who
 * appears, which stays a hard threshold gate.
 */
export function semanticSignals(
  roleVector: number[],
  candidates: SemanticCandidate[],
  source: EmbeddingSource,
): Map<string, number> {
  const signals = new Map<string, number>();

  for (const candidate of candidates) {
    const raw = cosine(roleVector, candidate.vector);
    signals.set(candidate.id, calibrate(raw, source));
  }

  return signals;
}

function calibrate(raw: number, source: EmbeddingSource): number {
  if (source === "openai") return clamp01((raw - 0.6) / 0.3);
  // Shared vocabulary between a role and a profile is a real signal here, but a
  // small one in absolute terms; 0.5 overlap is already a strong match.
  return clamp01(raw * 2);
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}
