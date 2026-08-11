import type { RawInterview } from "@/lib/data/types";

/**
 * Two handover implementations landed at once, writing two different things
 * into continuity_briefs.raw_interview_json.
 *
 * Dev 2's is the raw chat transcript, declared in lib/ai/handover.ts:
 *
 *   { version: 1, locale: "en", completed_at: "...", messages: [...] }
 *
 * Dev 3's is the structured answer set that lib/ai/challenge-gen.ts reads:
 *
 *   { role_title, recurring_tasks[], tools[], shortcuts[], coordinates_with[] }
 *
 * Both files claim to be the frozen contract, which is what happens when two
 * people implement the same phase in the same hour. Neither is wrong, and the
 * failure is silent rather than loud: a transcript has no `role_title` and no
 * `recurring_tasks`, so challenge generation falls back to "Transition role"
 * with a generic rubric and nothing crashes. The one feature Pillar 3b exists
 * for — scoring a replacement on the actual job — quietly stops happening.
 *
 * So read both. Dev 2's approved brief is markdown with fixed headings, which
 * is where the structure went, and it is the reviewed text rather than the raw
 * transcript — safer to build from anyway.
 */

/** Dev 2's shape, from lib/ai/handover.ts. */
export type TranscriptInterview = {
  version?: number;
  locale?: string;
  completed_at?: string;
  messages?: { role?: string; content?: string }[];
};

function isTranscript(value: unknown): value is TranscriptInterview {
  return (
    typeof value === "object" &&
    value !== null &&
    Array.isArray((value as TranscriptInterview).messages)
  );
}

function isStructured(value: unknown): value is RawInterview {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as RawInterview;
  return (
    typeof candidate.role_title === "string" ||
    Array.isArray(candidate.recurring_tasks)
  );
}

/** Pulls `- item` lines out of a `## Heading` section of Dev 2's markdown. */
function bulletsUnder(markdown: string, heading: string): string[] {
  const lines = markdown.split("\n");
  const start = lines.findIndex(
    (line) => line.trim().toLowerCase() === `## ${heading.toLowerCase()}`,
  );
  if (start === -1) return [];

  const items: string[] = [];
  for (const line of lines.slice(start + 1)) {
    const trimmed = line.trim();
    if (trimmed.startsWith("## ")) break;
    if (trimmed.startsWith("- ")) items.push(trimmed.slice(2).trim());
  }
  return items.filter(Boolean);
}

function titleOf(markdown: string): string | undefined {
  const line = markdown
    .split("\n")
    .find((candidate) => candidate.trim().startsWith("# "));
  return line?.trim().slice(2).trim() || undefined;
}

/** The prose before the first `## `, which Dev 2's engine calls the overview. */
function overviewOf(markdown: string): string | undefined {
  const lines = markdown.split("\n");
  const start = lines.findIndex((line) => line.trim().startsWith("# "));
  const body: string[] = [];
  for (const line of lines.slice(start + 1)) {
    if (line.trim().startsWith("## ")) break;
    if (line.trim()) body.push(line.trim());
  }
  return body.join(" ") || undefined;
}

/**
 * Whichever shape was written, hand challenge generation the one it reads.
 * `generatedBrief` is only consulted for the transcript shape, and only because
 * that is where Dev 2's structure survives.
 */
export function normalizeInterview(
  raw: unknown,
  generatedBrief?: string | null,
): RawInterview {
  if (isStructured(raw)) return raw;

  if (isTranscript(raw)) {
    const markdown = generatedBrief ?? "";
    const interview: RawInterview = {};

    const title = titleOf(markdown);
    if (title) interview.role_title = title;

    const tasks = bulletsUnder(markdown, "Recurring tasks");
    if (tasks.length) interview.recurring_tasks = tasks;

    const tools = bulletsUnder(markdown, "Tools and systems");
    if (tools.length) interview.tools = tools;

    // Decision points are the judgement calls the job turns on, which is the
    // same thing the structured shape means by a shortcut worth passing on.
    const shortcuts = [
      ...bulletsUnder(markdown, "Shortcuts"),
      ...bulletsUnder(markdown, "Decision points"),
    ];
    if (shortcuts.length) interview.shortcuts = shortcuts;

    const coordination = bulletsUnder(markdown, "Coordination");
    if (coordination.length) interview.coordinates_with = coordination;

    const notes = [
      overviewOf(markdown),
      ...bulletsUnder(markdown, "Common failure modes"),
    ]
      .filter(Boolean)
      .join(" ");
    if (notes) interview.notes = notes;

    return interview;
  }

  return {};
}
