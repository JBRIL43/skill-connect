import { embedMany } from "ai";
import { createOpenAI } from "@ai-sdk/openai";

import { isLiveAI, preferredProvider } from "@/lib/ai/provider";
import { tokens } from "@/lib/ai/text-signals";

/**
 * The embedding seam for Section 3's pgvector search.
 *
 * Both paths return vectors of the same width, which is the point: the columns
 * are `vector(1536)` and Postgres rejects anything else, so a demo machine with
 * no API key has to write something of the right shape or the persistence path
 * is untestable until the moment it matters. Swapping providers is one constant.
 *
 * Live embeddings stay on OpenAI's 1536-d models: Gemini's embedding widths do
 * not match the schema, so a Gemini-only machine uses the local hashed path.
 * Chat/grading still go through Gemini via lib/ai/provider.ts.
 *
 * The offline path is a hashed bag-of-words, not a language model. It encodes
 * lexical overlap and nothing more. It keeps the pipeline, the storage and the
 * ranking honest end to end; it does not make the matching smart.
 */

/** Fixed by the schema: skill_matrices.embedding and sme_postings.embedding. */
export const EMBEDDING_DIMENSIONS = 1536;

export type EmbeddingSource = "openai" | "local";

export type EmbedResult = {
  vectors: number[][];
  source: EmbeddingSource;
};

/** Which provider a run would use right now, without embedding anything. */
export function plannedSource(): EmbeddingSource {
  return isLiveAI() && process.env.OPENAI_API_KEY ? "openai" : "local";
}

export async function embedTexts(texts: string[]): Promise<EmbedResult> {
  if (texts.length === 0) return { vectors: [], source: plannedSource() };

  // Schema is vector(1536). Only OpenAI's small embedding model matches that
  // out of the box; Gemini-only deploys keep the deterministic local vectors.
  if (isLiveAI() && process.env.OPENAI_API_KEY) {
    try {
      const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const { embeddings } = await embedMany({
        model: openai.textEmbeddingModel(
          process.env.AI_EMBEDDING_MODEL ?? "text-embedding-3-small",
        ),
        values: texts,
      });

      const wrong = embeddings.find(
        (vector) => vector.length !== EMBEDDING_DIMENSIONS,
      );

      if (wrong) {
        // Writing these would fail at the column anyway; fall back rather than
        // half-persist a run.
        console.error(
          `[embed] model returned ${wrong.length} dimensions, expected ${EMBEDDING_DIMENSIONS}; using local vectors`,
        );
      } else {
        return { vectors: embeddings, source: "openai" };
      }
    } catch (error) {
      console.error("[embed] embedding call failed, using local vectors", error);
    }
  } else if (isLiveAI() && preferredProvider() === "gemini") {
    console.info(
      "[embed] Gemini-only mode: using local 1536-d vectors (schema width)",
    );
  }

  return { vectors: texts.map(localVector), source: "local" };
}

/**
 * Deterministic hashed bag-of-words, L2-normalised so cosine similarity is a
 * plain dot product and behaves like the live path.
 *
 * Each token contributes to two dimensions from two different hashes, which
 * softens collisions across a vocabulary far smaller than the vector width.
 */
export function localVector(text: string): number[] {
  const vector = new Array<number>(EMBEDDING_DIMENSIONS).fill(0);

  for (const token of tokens(text)) {
    const a = hash(token, 0x811c9dc5);
    const b = hash(token, 0x01000193);
    // Signed, so a token that appears in one text and not the other pushes the
    // vectors apart rather than only failing to pull them together.
    vector[a % EMBEDDING_DIMENSIONS] += 1;
    vector[b % EMBEDDING_DIMENSIONS] += (b & 1) === 0 ? 1 : -1;
  }

  return normalize(vector);
}

export function cosine(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dot = 0;
  for (let i = 0; i < a.length; i += 1) dot += a[i] * b[i];
  return Number.isFinite(dot) ? dot : 0;
}

function normalize(vector: number[]): number[] {
  let sum = 0;
  for (const value of vector) sum += value * value;
  const magnitude = Math.sqrt(sum);
  if (magnitude === 0) return vector;
  return vector.map((value) => value / magnitude);
}

/** FNV-1a. Cheap, stable across runs and machines, which is what matters here. */
function hash(text: string, seed: number): number {
  let value = seed >>> 0;
  for (let i = 0; i < text.length; i += 1) {
    value ^= text.charCodeAt(i);
    value = Math.imul(value, 0x01000193) >>> 0;
  }
  return value >>> 0;
}
