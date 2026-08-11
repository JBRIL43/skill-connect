/**
 * Both handover flows must produce a challenge built on the real job.
 *
 * The failure this guards is silent: feed challenge generation a chat
 * transcript and it returns a perfectly valid "Transition role" node with a
 * generic rubric and no error anywhere. Run with: npx tsx scripts/check-interview-shapes.ts
 */
import { generateLocally } from "@/lib/ai/challenge-gen";
import type { ContinuityBrief, SmePosting } from "@/lib/data/types";
import { normalizeInterview } from "@/lib/handover/normalize";

let failures = 0;

function check(label: string, ok: boolean, detail = "") {
  if (ok) {
    console.log(`  PASS  ${label}`);
  } else {
    failures += 1;
    console.log(`  FAIL  ${label}${detail ? `\n          ${detail}` : ""}`);
  }
}

const posting = {
  id: "post-dispatch",
  sme_id: "sme-kaliti",
  template_id: null,
  description: "Dispatch coordinator leaving after four years.",
  is_transition_role: true,
  status: "open",
} as unknown as SmePosting;

// Exactly what lib/ai/handover-engine.ts formatContinuityBrief emits.
const DEV2_MARKDOWN = `# Dispatch Coordinator

Runs the morning delivery cycle for a produce distributor in Addis Ababa.

## Recurring tasks
- Reconcile farm arrivals against the previous day orders before 5:30am
- Allocate two vans across ten customers before the 6am loading
- Confirm next-day quantities with the largest hotel each afternoon

## Tools and systems
- WhatsApp groups for drivers
- A shared order spreadsheet

## Decision points
- When supply is short, hotels are served before restaurants

## Shortcuts
- The regular wholesale buyer short-ships onions, so count them twice

## Coordination
- Two drivers
- The cooperative farm liaison

## Common failure modes
- A late truck cascades into every afternoon delivery

## Onboarding checklist
- Shadow the 5am reconciliation for three days
- Get added to the driver WhatsApp group
- Meet the farm liaison in person`;

function briefWith(raw: unknown, markdown: string): ContinuityBrief {
  return {
    id: "brief-1",
    posting_id: posting.id,
    raw_interview_json: raw as ContinuityBrief["raw_interview_json"],
    generated_brief: markdown,
    custom_node_id: null,
    reviewed_by_employee: true,
    created_at: new Date().toISOString(),
  };
}

console.log("Both handover flows reach challenge generation\n");

// ---------------------------------------------------- Dev 2: chat transcript
const transcript = {
  version: 1,
  locale: "en",
  completed_at: new Date().toISOString(),
  messages: [
    { role: "assistant", content: "What did the job involve?" },
    { role: "user", content: "Mostly the morning delivery run." },
    { role: "assistant", content: "Which tools?" },
    { role: "user", content: "WhatsApp and a spreadsheet." },
  ],
};

const fromTranscript = normalizeInterview(transcript, DEV2_MARKDOWN);
check(
  "a transcript still yields the role title",
  fromTranscript.role_title === "Dispatch Coordinator",
  `got ${JSON.stringify(fromTranscript.role_title)}`,
);
check(
  "and the real recurring tasks",
  (fromTranscript.recurring_tasks?.length ?? 0) === 3,
  `got ${JSON.stringify(fromTranscript.recurring_tasks)}`,
);
check(
  "and the tools",
  (fromTranscript.tools?.length ?? 0) === 2,
  `got ${JSON.stringify(fromTranscript.tools)}`,
);
check(
  "and the people the role coordinates with",
  (fromTranscript.coordinates_with?.length ?? 0) === 2,
  `got ${JSON.stringify(fromTranscript.coordinates_with)}`,
);
check(
  "decision points are carried as hard-won knowledge, not dropped",
  (fromTranscript.shortcuts?.length ?? 0) === 2,
  `got ${JSON.stringify(fromTranscript.shortcuts)}`,
);

const node = generateLocally({ posting, brief: briefWith(transcript, DEV2_MARKDOWN) });
check(
  "the generated challenge is named after the real role",
  node.title.startsWith("Dispatch Coordinator"),
  `got ${node.title}`,
);
check(
  "and its scenario quotes the actual work",
  node.scenario.includes("Reconcile farm arrivals"),
  "the scenario fell back to the generic transition text",
);

// ------------------------------------------------- Dev 3: structured answers
const structured = {
  role_title: "Dispatch Coordinator",
  recurring_tasks: ["Reconcile farm arrivals", "Allocate two vans"],
  tools: ["WhatsApp"],
  coordinates_with: ["Two drivers"],
};

const passthrough = normalizeInterview(structured, "irrelevant prose");
check(
  "the structured shape passes through untouched",
  passthrough.role_title === "Dispatch Coordinator" &&
    passthrough.recurring_tasks?.length === 2,
  JSON.stringify(passthrough),
);

const structuredNode = generateLocally({
  posting,
  brief: briefWith(structured, "irrelevant prose"),
});
check(
  "and generates from its own answers, not the prose",
  structuredNode.scenario.includes("Allocate two vans") &&
    !structuredNode.scenario.includes("irrelevant prose"),
  structuredNode.scenario.slice(0, 120),
);

// ------------------------------------------------------------------- empty
const empty = generateLocally({ posting, brief: briefWith(null, "") });
check(
  "an empty interview still degrades rather than throwing",
  empty.title.length > 0,
);

console.log("");
if (failures) {
  console.log(`${failures} check(s) FAILED.`);
  process.exit(1);
}
console.log("Both interview shapes produce a job-specific challenge.");
