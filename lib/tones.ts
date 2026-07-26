/**
 * Semantic tones for the sandbox and matcher surfaces, applied as className
 * overrides on the shared shadcn Badge rather than as a competing component.
 *
 * The mapping is deliberate and load-bearing for how the demo reads: green
 * means capability that has been graded, amber means an awarded badge, red is
 * reserved for a gap against a role threshold and is never used decoratively.
 */
export const TONE = {
  verified: "border-verdant-500/30 bg-verdant-500/10 text-verdant-400",
  award: "border-award-500/30 bg-award-500/10 text-award-400",
  gap: "border-gap-500/30 bg-gap-500/10 text-gap-400",
  info: "border-sky-500/30 bg-sky-500/10 text-sky-300",
  neutral: "border-ink-600 bg-ink-800/70 text-slate-300",
} as const;

export type Tone = keyof typeof TONE;
