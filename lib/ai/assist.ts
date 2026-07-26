import { generateText } from "ai";

import type { AssistTurn } from "@/lib/ai/grade";
import { aiModel, aiSource, isLiveAI, type AiSource } from "@/lib/ai/provider";
import type { SandboxMode } from "@/lib/data/types";
import { competencyLabel } from "@/lib/sandbox/competencies";
import type { SandboxNode } from "@/lib/sandbox/nodes";

export type AssistArgs = {
  node: SandboxNode;
  transcript: AssistTurn[];
  mode: SandboxMode;
};

export type AssistResult = { reply: string; source: AiSource };

const SUPPORTIVE_SYSTEM = [
  "You are the AI work assistant embedded in a Skill-Connect Ethiopia sandbox challenge.",
  "The candidate is learning to direct AI at a real business task — help them produce the deliverable, do not lecture them about theory.",
  "Do the work with them: draft, critique, and revise concrete text they can paste into their submission.",
  "Keep replies under 140 words, use plain language, and prefer short lines a small-business owner would actually read.",
  "The context is Ethiopian small business. Use Birr for prices and keep examples local and practical.",
].join(" ");

/**
 * Section 9, point 5 and Section 2, point 5: the strict persona stays critical of
 * the work product only. This wording is the boundary, and it is enforced here in
 * the prompt rather than left to the model's discretion.
 */
const PRESSURE_SYSTEM = [
  "You are a demanding but professional manager reviewing work under deadline inside a Skill-Connect sandbox challenge.",
  "You are blunt about the WORK PRODUCT: name what is missing, what would fail with a real customer, and what you need next.",
  "You are never demeaning about the person. No insults, no comments about their intelligence, background, identity, or worth, and never discouragement about their future.",
  "Push on specifics and deadlines, not on the candidate. Keep replies under 120 words.",
  "If the candidate asks to stop or seems distressed, tell them plainly they can switch back to supportive coaching mode at any time.",
].join(" ");

export async function assistReply(args: AssistArgs): Promise<AssistResult> {
  if (isLiveAI()) {
    try {
      const { text } = await generateText({
        model: aiModel(),
        system:
          args.mode === "pressure_simulation"
            ? PRESSURE_SYSTEM
            : SUPPORTIVE_SYSTEM,
        prompt: [
          `Challenge context: ${args.node.assistantContext}`,
          `Scenario: ${args.node.scenario}`,
          `Deliverable the candidate must submit: ${args.node.deliverable}`,
          "Conversation so far:",
          args.transcript
            .map(
              (turn) =>
                `${turn.role === "user" ? "Candidate" : "Assistant"}: ${turn.content}`,
            )
            .join("\n"),
          "Reply as the assistant's next turn only.",
        ].join("\n\n"),
      });

      return { reply: text.trim(), source: aiSource() };
    } catch (error) {
      console.error("[assist] live call failed, using stub assistant", error);
    }
  }

  return { reply: stubReply(args), source: "stub" };
}

function stubReply({ node, transcript, mode }: AssistArgs): string {
  const userTurns = transcript.filter((turn) => turn.role === "user");
  const last = userTurns.at(-1)?.content.trim() ?? "";
  const focus = node.rubric[0];
  const secondary = node.rubric[1] ?? node.rubric[0];
  const stage = userTurns.length;

  if (mode === "pressure_simulation") {
    const pressure = [
      `Fine — but that is not a deliverable yet. I need ${node.deliverable.toLowerCase()} Give me the actual text, not a description of the text. You can switch back to supportive coaching mode at any time.`,
      `Closer. The part that would fail in front of a real customer is ${competencyLabel(focus.competency).toLowerCase()}: ${focus.criteria} Fix that specifically and send it back.`,
      `Stop expanding and start tightening. Cut anything a busy owner would skip, keep the numbers exact, and make the next step obvious. Then submit.`,
      `That is workable. Submit it — the rubric scores ${competencyLabel(focus.competency).toLowerCase()} and ${competencyLabel(secondary.competency).toLowerCase()} hardest, so read it once more against those two.`,
    ];
    return pressure[Math.min(stage - 1, pressure.length - 1)] ?? pressure[0];
  }

  if (stage <= 1) {
    return [
      last
        ? `Good starting point. Before I draft anything, two things I need from you: who exactly is reading this, and what should happen after they read it?`
        : `Tell me what you want to produce first and I will draft it with you.`,
      "",
      `For this task the submission has to be: ${node.deliverable}`,
      "",
      `A structure that works here: open with what is on offer, then the concrete details with numbers, then one clear next step. Give me the details you have and I will turn them into the first draft.`,
    ].join("\n");
  }

  if (stage === 2) {
    return [
      `Here is a first draft to react to, based on what you gave me:`,
      "",
      `Opening line naming the business and what is available today. Then one short line per item with its price in Birr — no paragraphs, people read these on a phone. Then a single closing line telling the reader exactly how to respond.`,
      "",
      `Now the useful part: tell me what is wrong with it. The rubric here weights ${competencyLabel(focus.competency).toLowerCase()} most heavily — ${focus.criteria}`,
    ].join("\n");
  }

  if (stage === 3) {
    return [
      `Better. Two specific fixes before you submit:`,
      "",
      `1. Be concrete where you are currently vague — exact numbers, exact next step, no "contact us for details".`,
      `2. Cover the second part of the brief explicitly. Graders check ${competencyLabel(secondary.competency).toLowerCase()}: ${secondary.criteria}`,
      "",
      `Paste your revised version and I will tell you if it is submittable.`,
    ].join("\n");
  }

  return [
    `That reads like something the business could send today.`,
    "",
    `Before you submit, check it against the rubric you can see on the left — every line there is scored. If ${competencyLabel(focus.competency).toLowerCase()} is covered and the numbers are right, submit it.`,
  ].join("\n");
}
