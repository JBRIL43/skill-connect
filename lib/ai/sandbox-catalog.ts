/**
 * Read-only mirror of Dev 3's published static Sandbox registry
 * (`origin/dev3/pillar3-matcher` → `lib/sandbox/nodes.ts` + `docs/dev3-contracts.md`).
 *
 * Deep links use `/sandbox/<node_id>`. Do not invent IDs here — only the
 * authored challenges Dev 3 already shipped.
 */

export const SANDBOX_COMPETENCY_KEYS = [
  "ai_prompt_literacy",
  "task_accuracy",
  "customer_comms",
  "data_tools",
  "process_thinking",
  "adaptability",
] as const;

export type SandboxCompetencyKey = (typeof SANDBOX_COMPETENCY_KEYS)[number];

export type SandboxCatalogNode = {
  id: string;
  title: string;
  titleAm: string;
  sector: "textiles" | "retail" | "agritech";
  summary: string;
  competencies: SandboxCompetencyKey[];
  href: string;
};

export const SANDBOX_CATALOG: readonly SandboxCatalogNode[] = [
  {
    id: "merkato-whatsapp-catalog",
    title: "WhatsApp catalog for a Merkato textile shop",
    titleAm: "የመርካቶ ጨርቃ ጨርቅ ሱቅ የWhatsApp ካታሎግ",
    sector: "textiles",
    summary:
      "Direct an AI assistant to turn handwritten fabric prices into a WhatsApp-ready catalog.",
    competencies: ["ai_prompt_literacy", "customer_comms", "task_accuracy"],
    href: "/sandbox/merkato-whatsapp-catalog",
  },
  {
    id: "retail-inventory-tracker",
    title: "Inventory tracker for a retail shop",
    titleAm: "የችርቻሮ ሱቅ የክምችት መከታተያ",
    sector: "retail",
    summary:
      "Design a practical stock sheet and reorder rule for a Bole Road accessories shop.",
    competencies: ["data_tools", "task_accuracy", "ai_prompt_literacy"],
    href: "/sandbox/retail-inventory-tracker",
  },
  {
    id: "agritech-delivery-schedule",
    title: "Delivery schedule for a vegetable supplier",
    titleAm: "የአትክልት አቅራቢ የማድረስ መርሐግብር",
    sector: "agritech",
    summary:
      "Build a two-van morning dispatch plan that survives spoilage and a breakdown.",
    competencies: ["process_thinking", "task_accuracy", "adaptability"],
    href: "/sandbox/agritech-delivery-schedule",
  },
] as const;

export const SANDBOX_NODE_ID_TUPLE = [
  "merkato-whatsapp-catalog",
  "retail-inventory-tracker",
  "agritech-delivery-schedule",
] as const;

export type SandboxNodeId = (typeof SANDBOX_NODE_ID_TUPLE)[number];

export const SANDBOX_NODE_IDS: readonly SandboxNodeId[] = SANDBOX_NODE_ID_TUPLE;

export function getCatalogNode(id: string): SandboxCatalogNode | undefined {
  return SANDBOX_CATALOG.find((node) => node.id === id);
}

export function isSandboxNodeId(value: string): value is SandboxNodeId {
  return (SANDBOX_NODE_ID_TUPLE as readonly string[]).includes(value);
}
