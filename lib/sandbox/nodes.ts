import type { CompetencyKey } from "@/lib/sandbox/competencies";

/**
 * Shared by the grade route's validation and the submit button's disabled state,
 * so the client cannot offer a submission the server will reject. It lives here
 * rather than in the route because Next forbids non-handler exports from one.
 */
export const MIN_SUBMISSION_CHARS = 40;

export type RubricLine = {
  competency: CompetencyKey;
  /** Weights per node sum to 1. Used by both the stub grader and Match Score. */
  weight: number;
  /** Shown to the candidate before they submit — the rubric is never hidden. */
  criteria: string;
};

export type SandboxNode = {
  id: string;
  title: string;
  titleAm: string;
  sector: "textiles" | "retail" | "agritech" | "transition";
  difficulty: "starter" | "core" | "advanced";
  estimatedMinutes: number;
  /** One-line summary for the node tree. */
  summary: string;
  /** The business scenario the candidate is dropped into. */
  scenario: string;
  /** What they must produce. */
  deliverable: string;
  rubric: RubricLine[];
  /** Context handed to the embedded AI assistant for this node. */
  assistantContext: string;
  /** Prerequisite node ids — drives the tree edges. */
  requires: string[];
  badgeName: string;
  /** Section 2 point 5: only some nodes may run the strict-manager persona. */
  pressureSimulationAllowed: boolean;
  /** Set for AI-generated Pillar 3b challenges. */
  generatedFromPostingId?: string;
};

export const SANDBOX_NODES: SandboxNode[] = [
  {
    id: "merkato-whatsapp-catalog",
    title: "WhatsApp catalog for a Merkato textile shop",
    titleAm: "የመርካቶ ጨርቃ ጨርቅ ሱቅ የWhatsApp ካታሎግ",
    sector: "textiles",
    difficulty: "starter",
    estimatedMinutes: 20,
    summary:
      "A textile trader wants to sell over WhatsApp but has only handwritten prices. Direct an AI assistant to build the catalog.",
    scenario:
      "Hanna runs a fabric stall in Merkato. She has 12 fabric types with prices written in a notebook, sells mostly to tailors and small dressmakers, and just started getting WhatsApp orders she keeps losing track of. She does not want a website — she wants something she can send in a chat today.",
    deliverable:
      "A WhatsApp-ready product catalog message covering the fabrics, prices per meter, and how a customer places an order — plus one short follow-up message she can reuse when a customer asks for something out of stock.",
    rubric: [
      {
        competency: "ai_prompt_literacy",
        weight: 0.4,
        criteria:
          "Briefed the assistant with the real constraints (WhatsApp, tailors as buyers, price per meter) and pushed back on generic marketing output instead of accepting the first draft.",
      },
      {
        competency: "customer_comms",
        weight: 0.35,
        criteria:
          "The catalog reads naturally to an Ethiopian tailor: short lines, clear prices, an obvious next step, no corporate filler.",
      },
      {
        competency: "task_accuracy",
        weight: 0.25,
        criteria:
          "Covers the fabrics and prices actually given, includes the ordering step and the out-of-stock follow-up, and invents no products or claims.",
      },
    ],
    assistantContext:
      "The user is completing a Skill-Connect sandbox challenge for a Merkato textile stall owner named Hanna who sells fabric by the meter to tailors and takes orders on WhatsApp.",
    requires: [],
    badgeName: "AI Catalog Builder",
    pressureSimulationAllowed: false,
  },
  {
    id: "retail-inventory-tracker",
    title: "Inventory tracker for a retail shop",
    titleAm: "የችርቻሮ ሱቅ የክምችት መከታተያ",
    sector: "retail",
    difficulty: "core",
    estimatedMinutes: 25,
    summary:
      "A small electronics retailer keeps running out of fast-moving stock. Design the sheet and the restock rule with AI.",
    scenario:
      "Yonas owns a small electronics shop on Bole Road. He stocks phone accessories, sells 30 to 60 items a day, and keeps discovering he is out of the exact chargers customers ask for. He records sales on paper at closing time and has one shop assistant who will actually have to use whatever you design.",
    deliverable:
      "A spreadsheet structure (columns plus one worked example row) for tracking stock in and out, a simple reorder rule that tells him when to restock a line, and the two-sentence instruction he gives his assistant.",
    rubric: [
      {
        competency: "data_tools",
        weight: 0.4,
        criteria:
          "Columns capture what the reorder decision actually needs — quantity on hand, sales rate, reorder point — and the worked example is internally consistent.",
      },
      {
        competency: "task_accuracy",
        weight: 0.3,
        criteria:
          "The reorder rule is specific and computable from the columns given, not vague advice like 'restock when low'.",
      },
      {
        competency: "ai_prompt_literacy",
        weight: 0.3,
        criteria:
          "Used the assistant to test the design against a real scenario (a fast-selling line, a slow one) rather than asking it once for a template.",
      },
    ],
    assistantContext:
      "The user is completing a Skill-Connect sandbox challenge for Yonas, who owns a small phone-accessory shop in Addis Ababa and tracks stock on paper.",
    requires: ["merkato-whatsapp-catalog"],
    badgeName: "Inventory Systems Designer",
    pressureSimulationAllowed: true,
  },
  {
    id: "agritech-delivery-schedule",
    title: "Delivery schedule for a vegetable supplier",
    titleAm: "የአትክልት አቅራቢ የማድረስ መርሐግብር",
    sector: "agritech",
    difficulty: "advanced",
    estimatedMinutes: 30,
    summary:
      "Produce spoils, one van breaks down, and a hotel changes its order. Build a schedule that survives contact with reality.",
    scenario:
      "A cooperative outside Addis Ababa supplies vegetables to eight restaurants and two hotels using two vans. Produce arrives from farms early morning, spoils within about two days, and the biggest hotel changes its order quantity with a day's notice. Yesterday one van broke down at 6am and three deliveries were missed.",
    deliverable:
      "A morning dispatch plan for the two vans, the rule for deciding what gets dropped or delayed when a van is down, and a short message the coordinator sends a customer whose delivery slips.",
    rubric: [
      {
        competency: "process_thinking",
        weight: 0.4,
        criteria:
          "The plan sequences loading, routing, and handoffs in a way that respects spoilage and the two-van limit, and the drop rule has a clear priority order.",
      },
      {
        competency: "task_accuracy",
        weight: 0.3,
        criteria:
          "Works within the stated constraints (two vans, eight restaurants, two hotels, two-day shelf life) without quietly adding resources.",
      },
      {
        competency: "adaptability",
        weight: 0.3,
        criteria:
          "Handles the van breakdown and the changed hotel order explicitly, including the customer message, instead of assuming a perfect morning.",
      },
    ],
    assistantContext:
      "The user is completing a Skill-Connect sandbox challenge for a vegetable-supply cooperative near Addis Ababa that delivers to restaurants and hotels with two vans.",
    requires: ["retail-inventory-tracker"],
    badgeName: "Operations Planner",
    pressureSimulationAllowed: true,
  },
];

export const SANDBOX_NODE_IDS = SANDBOX_NODES.map((node) => node.id);

export function getStaticNode(id: string): SandboxNode | undefined {
  return SANDBOX_NODES.find((node) => node.id === id);
}

/** Competencies a node can award, highest weight first. */
export function nodeCompetencies(node: SandboxNode): CompetencyKey[] {
  return [...node.rubric]
    .sort((a, b) => b.weight - a.weight)
    .map((line) => line.competency);
}

/** Which nodes train a given competency — Dev 2's career recommendations use this. */
export function nodesForCompetency(competency: CompetencyKey): SandboxNode[] {
  return SANDBOX_NODES.filter((node) =>
    node.rubric.some((line) => line.competency === competency),
  );
}
