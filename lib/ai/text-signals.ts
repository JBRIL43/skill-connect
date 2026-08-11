/**
 * Deterministic text signals behind the stub grader. Not intelligence — just
 * measurable properties of a submission that correlate with the rubric, so the
 * offline path produces varied, defensible-looking scores instead of constants.
 */

const STOP_WORDS = new Set([
  "the", "and", "for", "with", "that", "this", "from", "they", "them", "their",
  "have", "has", "was", "were", "been", "will", "would", "there", "then",
  "than", "into", "when", "what", "which", "who", "your", "you", "her", "his",
  "she", "him", "are", "not", "but", "all", "any", "can", "how", "out", "one",
  "two", "get", "got", "our", "she", "him", "some", "most", "just", "only",
]);

export function tokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z\u1200-\u137f\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 3 && !STOP_WORDS.has(word));
}

export function keywords(text: string, limit = 40): string[] {
  return Array.from(new Set(tokens(text))).slice(0, limit);
}

/** Share of the brief's distinctive words the submission actually engages with. */
export function keywordCoverage(source: string, submission: string): number {
  const wanted = keywords(source);
  if (wanted.length === 0) return 0.5;
  const present = new Set(tokens(submission));
  const hits = wanted.filter((word) => present.has(word)).length;
  return hits / wanted.length;
}

export type TextShape = {
  words: number;
  lines: number;
  listLines: number;
  digitGroups: number;
  hasCurrency: boolean;
  sequenceWords: number;
  contingencyWords: number;
  avgSentenceWords: number;
};

const SEQUENCE_WORDS = /\b(first|then|next|after|before|finally|by \d|step \d|morning|daily|每)\b/gi;
const CONTINGENCY_WORDS =
  /\b(if|when|instead|unless|otherwise|backup|fallback|delayed|breaks|priority|fails)\b/gi;

export function textShape(text: string): TextShape {
  const trimmed = text.trim();
  const lines = trimmed.split(/\n+/).filter((line) => line.trim().length > 0);
  const sentences = trimmed.split(/[.!?።]+/).filter((part) => part.trim().length > 0);
  const words = trimmed.split(/\s+/).filter(Boolean).length;

  return {
    words,
    lines: lines.length,
    listLines: lines.filter((line) => /^\s*([-*•]|\d+[.)]|[a-z][.)])\s+/i.test(line)).length,
    digitGroups: (trimmed.match(/\d+/g) ?? []).length,
    hasCurrency: /(birr|etb|\bbr\b|price|per meter|per kg)/i.test(trimmed),
    sequenceWords: (trimmed.match(SEQUENCE_WORDS) ?? []).length,
    contingencyWords: (trimmed.match(CONTINGENCY_WORDS) ?? []).length,
    avgSentenceWords: sentences.length ? words / sentences.length : words,
  };
}

/** Stable pseudo-jitter so two different submissions never score identically. */
export function hashJitter(seed: string, spread = 4): number {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  const normalized = Math.abs(hash % (spread * 2 + 1));
  return normalized - spread;
}

export function clampScore(value: number, floor = 38, ceiling = 94): number {
  return Math.max(floor, Math.min(ceiling, Math.round(value)));
}
