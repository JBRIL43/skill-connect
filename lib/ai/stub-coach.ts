import {
  SANDBOX_CATALOG,
  isSandboxNodeId,
  type SandboxCompetencyKey,
  type SandboxNodeId,
} from "./sandbox-catalog";
import {
  coachSignalsToSandboxCompetencies,
  type CareerRecommendations,
} from "./recommendations";
import type {
  ConversationMessage,
  ConversationMode,
  SkillMatrixOutput,
} from "./schemas";

/**
 * The coach, with no API key.
 *
 * Every call in lib/ai/engine.ts goes through getAiModel(), which throws when
 * OPENAI_API_KEY is unset, so /coach currently renders and then fails on the
 * first message. That is the whole of Pillar 1 gone if the venue wifi is bad or
 * the key is rate-limited mid-demo — and no key is the state this repo is
 * actually in.
 *
 * So: the same bargain the sandbox grader already makes under AI_MODE=stub.
 * Deterministic, offline, derived from what the person actually typed. It is
 * not a language model and does not pretend to be one on inspection; it is a
 * coach that asks real questions in order and reads real signal out of the
 * answers. Swaps back to the live engine the moment a key exists.
 */

// ---------------------------------------------------------------- signals

/**
 * Weak keyword evidence, in both scripts. Crude by design: the alternative is
 * inventing numbers, and a score nobody can trace back to a sentence they typed
 * is worse than a rough one they can.
 */
const SIGNALS: Record<string, string[]> = {
  digital_literacy: [
    "computer", "laptop", "phone", "excel", "spreadsheet", "word", "email",
    "internet", "software", "app", "ኮምፒውተር", "ስልክ",
  ],
  ai_literacy: [
    "ai", "chatgpt", "gpt", "prompt", "chatbot", "artificial intelligence",
    "automation", "ኤአይ",
  ],
  data_handling: [
    "data", "record", "records", "inventory", "stock", "report", "numbers",
    "count", "track", "ledger", "መረጃ", "ሂሳብ",
  ],
  domain_tools: [
    "pos", "system", "machine", "tool", "equipment", "software", "platform",
    "telebirr", "quickbooks", "peachtree",
  ],
  problem_solving: [
    "problem", "solve", "fix", "figure", "troubleshoot", "decide", "issue",
    "ችግር",
  ],
  adaptability: [
    "learn", "learned", "new", "change", "changed", "adapt", "quickly",
    "switch", "ተማርኩ", "አዲስ",
  ],
  communication: [
    "customer", "client", "explain", "talk", "call", "whatsapp", "negotiate",
    "sell", "wrote", "ደንበኛ",
  ],
  collaboration: [
    "team", "colleague", "together", "help", "helped", "coordinate", "manager",
    "ቡድን",
  ],
  empathy: [
    "listen", "understand", "patient", "complaint", "upset", "care", "support",
  ],
};

const BASE = 42;
const PER_HIT = 9;
const CEILING = 88;

function scoreFor(axis: string, transcript: string): number {
  const words = SIGNALS[axis] ?? [];
  const hits = words.filter((word) => transcript.includes(word)).length;
  // Length is weak evidence of effort, and worth a nudge so a thoughtful
  // answer does not score identically to a one-word one.
  const depth = Math.min(3, Math.floor(transcript.length / 400));
  return Math.min(CEILING, BASE + hits * PER_HIT + depth * 2);
}

function userText(messages: ConversationMessage[]): string {
  return messages
    .filter((message) => message.role === "user")
    .map((message) => message.content)
    .join("\n")
    .toLowerCase();
}

// -------------------------------------------------------------- the chat

const COACH_QUESTIONS = [
  "Tell me about the work you have done — paid, unpaid, family business, all of it counts.",
  "Which part of that did you actually enjoy? I am listening for what you would do again.",
  "What do you use to get work done? Anything from a phone and WhatsApp to a full computer system.",
  "Have you used AI tools like ChatGPT for anything yet? An honest no is useful — it tells me where to start.",
  "Tell me about a time something went wrong at work. What did you do?",
  "Last one: what is getting in the way right now — time, transport, equipment, certificates?",
];

const ACKNOWLEDGEMENTS = [
  "That is real experience, and it counts for more than people tell you it does.",
  "Good — that tells me something about how you work, not just what you know.",
  "Noted. That is the kind of detail employers never see on a CV.",
  "Thank you, that is useful.",
  "That is a solid answer.",
];

const ENOUGH =
  "You have given me enough to work with across your background, your tools, how you handle things going wrong, and what you are working around. Press \"Create my skill map\" and I will turn this into a starting picture. It is an initial read, not a verified score — the Sandbox challenges are what make a score real.";

function coachReply(messages: ConversationMessage[]): string {
  const answered = messages.filter((message) => message.role === "user").length;

  if (answered >= COACH_QUESTIONS.length) return ENOUGH;

  const ack = ACKNOWLEDGEMENTS[(answered - 1 + ACKNOWLEDGEMENTS.length) % ACKNOWLEDGEMENTS.length];
  const question = COACH_QUESTIONS[answered];

  if (answered === 0) return question;
  return `${ack}\n\n${question}`;
}

const CHATBOT_FACTS: { match: string[]; answer: string }[] = [
  {
    match: ["sandbox", "challenge", "score"],
    answer:
      "Sandbox challenges are short work simulations graded against a rubric you can read before you start. Finishing one produces a verified Sandbox Score, which is the only score employers ever see.",
  },
  {
    match: ["match", "employer", "sme", "hire", "job"],
    answer:
      "An employer builds a Role Skill Template with a minimum score per competency. You only enter matching once you opt in to being discoverable, and they see your score and a gap analysis — never your coach conversation or skill map.",
  },
  {
    match: ["coach", "skill map", "intake"],
    answer:
      "The coach is a conversation that produces a preliminary skill map. It is an initial read, not a verified score, and it is private to you.",
  },
  {
    match: ["handover", "transition", "brief", "leaving"],
    answer:
      "When someone leaves a role, they can record a handover interview. It becomes a continuity brief that they review and redact themselves, and only then can it become a challenge for whoever replaces them.",
  },
];

function chatbotReply(messages: ConversationMessage[]): string {
  const question = messages
    .filter((message) => message.role === "user")
    .at(-1)
    ?.content.toLowerCase() ?? "";

  const fact = CHATBOT_FACTS.find((entry) =>
    entry.match.some((word) => question.includes(word)),
  );

  return (
    fact?.answer ??
    "I can explain how the coach, the Sandbox challenges, matching, or the handover interview work. Ask about one of those and I will keep it short."
  );
}

const HANDOVER_QUESTIONS = [
  "Start wherever you like: what did this job actually involve, most days?",
  "What did you use to do it? Paper, WhatsApp and a notebook all count as tools.",
  "When something had to be decided quickly, what did you weigh up?",
  "What do you know that is not written down anywhere?",
  "Who did you have to deal with to get the job done? Roles rather than names, please.",
  "What went wrong most often, and what did you do about it?",
];

function handoverReply(messages: ConversationMessage[]): string {
  const answered = messages.filter((message) => message.role === "user").length;
  if (answered >= HANDOVER_QUESTIONS.length) {
    return "That is enough to write the brief from. You will get to read it and cut anything you are not willing to share before anyone else sees it.";
  }
  if (answered === 0) return HANDOVER_QUESTIONS[0];
  return `Got it.\n\n${HANDOVER_QUESTIONS[answered]}`;
}

export function stubReply(
  mode: ConversationMode,
  messages: ConversationMessage[],
): string {
  if (mode === "chatbot") return chatbotReply(messages);
  if (mode === "handover") return handoverReply(messages);
  return coachReply(messages);
}

/**
 * Streams a word at a time. Not for show: the client renders progressively as
 * bytes arrive, and delivering the whole reply in one chunk makes the UI jump
 * in a way that reads as broken.
 */
export function stubReplyStream(
  mode: ConversationMode,
  messages: ConversationMessage[],
): ReadableStream<Uint8Array> {
  const words = stubReply(mode, messages).split(" ");
  const encoder = new TextEncoder();
  let index = 0;

  return new ReadableStream({
    async pull(controller) {
      if (index >= words.length) {
        controller.close();
        return;
      }
      const chunk = index === 0 ? words[index] : ` ${words[index]}`;
      index += 1;
      controller.enqueue(encoder.encode(chunk));
      await new Promise((resolve) => setTimeout(resolve, 18));
    },
  });
}

// ------------------------------------------------------------ skill matrix

export function stubSkillMatrix(
  messages: ConversationMessage[],
): SkillMatrixOutput {
  const transcript = userText(messages);

  const technical = {
    digital_literacy: scoreFor("digital_literacy", transcript),
    ai_literacy: scoreFor("ai_literacy", transcript),
    data_handling: scoreFor("data_handling", transcript),
    domain_tools: scoreFor("domain_tools", transcript),
  };

  const human = {
    problem_solving: scoreFor("problem_solving", transcript),
    adaptability: scoreFor("adaptability", transcript),
    communication: scoreFor("communication", transcript),
    collaboration: scoreFor("collaboration", transcript),
    empathy: scoreFor("empathy", transcript),
  };

  const strongest = Object.entries({ ...technical, ...human }).sort(
    (a, b) => b[1] - a[1],
  )[0];

  return {
    technical,
    human,
    raw_notes: `Read from a ${
      messages.filter((message) => message.role === "user").length
    }-answer intake. Strongest signal was ${strongest[0].replace(/_/g, " ")}. This is a starting picture drawn from what you described, not a verified score — a Sandbox challenge is what makes a score real.`,
  };
}

// --------------------------------------------------------- recommendations

/** Picks challenges that close the weakest mapped competencies. */
export function stubRecommendations(
  matrix: SkillMatrixOutput,
): CareerRecommendations {
  const mapped = coachSignalsToSandboxCompetencies(matrix);

  const gapFor = (competencies: SandboxCompetencyKey[]) =>
    competencies.reduce((total, key) => total + (100 - (mapped[key] ?? 50)), 0) /
    competencies.length;

  // Filtered through the same allow-list the live path enforces, so the stub
  // cannot produce a deep link to a challenge that does not exist either.
  const ranked = SANDBOX_CATALOG.filter((node) => isSandboxNodeId(node.id))
    .map((node) => ({
      node,
      id: node.id as SandboxNodeId,
      gap: gapFor(node.competencies),
    }))
    .sort((a, b) => b.gap - a.gap)
    .slice(0, 3);

  return {
    recommendations: ranked.map(({ node, id }) => {
      const weakest = [...node.competencies].sort(
        (a, b) => (mapped[a] ?? 50) - (mapped[b] ?? 50),
      )[0];

      return {
        path_name: node.title,
        reason: `Your intake read ${weakest.replace(/_/g, " ")} at ${
          mapped[weakest] ?? 50
        } out of 100, which is the gap this challenge is built to close. Finishing it turns that estimate into a verified score employers can match against.`,
        node_ids: [id],
      };
    }),
  };
}
