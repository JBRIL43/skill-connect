import type { RawInterview, SmePosting } from "@/lib/data/types";

/**
 * Pillar 3b's handover interview, in the shape Phase 8 already consumes.
 *
 * The spec has this driven by a model, one question at a time. It is a fixed
 * script instead, for the same reason the sandbox grades deterministically
 * under AI_MODE=stub: the demo has to survive a venue with no network and a
 * machine with no API key. What the employee types is real either way, and the
 * questions map one-to-one onto RawInterview, so a scripted run and a
 * model-driven run produce an identical row.
 *
 * Dev 2's streaming route is the upgrade path. Their `handover` prompt in
 * lib/ai/prompts.ts already asks for exactly these five things, so swapping the
 * transcript in means replacing toRawInterview's input, not any of the callers.
 *
 * Nothing here may import the AI SDK: the interview form is a client component
 * and imports the question script from this file.
 */

export type InterviewQuestionId =
  | "role_title"
  | "recurring_tasks"
  | "tools"
  | "shortcuts"
  | "coordinates_with"
  | "notes";

export type InterviewQuestion = {
  id: InterviewQuestionId;
  /** What the outgoing employee is asked, in their own terms. */
  prompt: string;
  /** Shown under the field. Steers away from client names before redaction. */
  hint: string;
  /** One item per line, rather than a single blob. */
  list: boolean;
  required: boolean;
};

export const INTERVIEW_QUESTIONS: readonly InterviewQuestion[] = [
  {
    id: "role_title",
    prompt: "What would you call this job?",
    hint: "The title you would use talking to a friend, not the one on paper.",
    list: false,
    required: true,
  },
  {
    id: "recurring_tasks",
    prompt: "What did you actually do, most days?",
    hint: "One per line. Include the time of day if it matters.",
    list: true,
    required: true,
  },
  {
    id: "tools",
    prompt: "What did you use to do it?",
    hint: "One per line. Paper and WhatsApp count as tools.",
    list: true,
    required: false,
  },
  {
    id: "shortcuts",
    prompt: "What do you know that is not written down anywhere?",
    hint: "One per line. The things you would tell your replacement over coffee.",
    list: true,
    required: false,
  },
  {
    id: "coordinates_with",
    prompt: "Who did you deal with to get the job done?",
    hint: "One per line. Use roles rather than names — you can still redact later.",
    list: true,
    required: false,
  },
  {
    id: "notes",
    prompt: "Anything else your replacement should know?",
    hint: "Optional. Free text.",
    list: false,
    required: false,
  },
];

const MIN_TASKS = 2;

export type InterviewAnswers = Partial<Record<InterviewQuestionId, string>>;

function lines(value: string | undefined): string[] {
  return (value ?? "")
    .split("\n")
    .map((line) => line.replace(/^[-•*\d.)\s]+/, "").trim())
    .filter(Boolean);
}

/** Turns the raw form input into the stored shape. */
export function toRawInterview(answers: InterviewAnswers): RawInterview {
  const interview: RawInterview = {};

  const title = (answers.role_title ?? "").trim();
  if (title) interview.role_title = title;

  const tasks = lines(answers.recurring_tasks);
  if (tasks.length) interview.recurring_tasks = tasks;

  const tools = lines(answers.tools);
  if (tools.length) interview.tools = tools;

  const shortcuts = lines(answers.shortcuts);
  if (shortcuts.length) interview.shortcuts = shortcuts;

  const partners = lines(answers.coordinates_with);
  if (partners.length) interview.coordinates_with = partners;

  const notes = (answers.notes ?? "").trim();
  if (notes) interview.notes = notes;

  return interview;
}

/**
 * Enough signal for Phase 8 to build a challenge worth scoring. A title and one
 * task would technically generate, but produces a challenge so thin it reads as
 * a bug on stage.
 */
export function interviewGaps(interview: RawInterview): string[] {
  const gaps: string[] = [];
  if (!interview.role_title) {
    gaps.push("the job needs a title");
  }
  if ((interview.recurring_tasks?.length ?? 0) < MIN_TASKS) {
    gaps.push(`describe at least ${MIN_TASKS} things you did most days`);
  }
  return gaps;
}

function sentence(parts: string[]): string {
  const clean = parts.filter(Boolean);
  if (clean.length === 0) return "";
  if (clean.length === 1) return clean[0];
  return `${clean.slice(0, -1).join(", ")} and ${clean[clean.length - 1]}`;
}

/** Deterministic assembly — no key, no network, same input same output. */
export function composeBriefLocally(
  interview: RawInterview,
  posting: SmePosting,
): string {
  const title = interview.role_title ?? "This role";
  const tasks = interview.recurring_tasks ?? [];
  const tools = interview.tools ?? [];
  const partners = interview.coordinates_with ?? [];
  const shortcuts = interview.shortcuts ?? [];

  const paragraphs = [
    tasks.length
      ? `The ${title.toLowerCase()} role covers ${tasks.length} recurring ${
          tasks.length === 1 ? "duty" : "duties"
        }: ${sentence(tasks.map((task) => task.replace(/\.$/, "")))}.`
      : `The ${title.toLowerCase()} role is being handed over.`,
    tools.length
      ? `The work runs on ${sentence(tools.map((tool) => tool.toLowerCase()))}.`
      : "",
    partners.length
      ? `Day to day it means dealing with ${sentence(
          partners.map((partner) => partner.toLowerCase()),
        )}.`
      : "",
    shortcuts.length
      ? `Things the outgoing employee wanted passed on: ${sentence(
          shortcuts.map((item) => item.replace(/\.$/, "")),
        )}.`
      : "",
    interview.notes ? interview.notes.trim() : "",
    posting.description ? `Posting context: ${posting.description}` : "",
  ];

  return paragraphs.filter(Boolean).join(" ");
}
