import type {
  Badge,
  CompanyProfile,
  ContinuityBrief,
  Match,
  Notification,
  Profile,
  RoleSkillTemplate,
  SandboxScore,
  ScoreMap,
  SkillMatrix,
  SmePosting,
} from "@/lib/data/types";

/**
 * Synthetic demo data. Every person and company here is invented — Section 11's
 * hard rule. The non-technical lead's larger seed files (roughly 20 job seekers,
 * 8-10 SMEs) drop straight into these same shapes; this smaller set exists so
 * Dev 3's surfaces are demoable before those files arrive.
 *
 * Deliberate properties the demo depends on:
 * - Selam has a skill matrix but no Sandbox Scores. She is the "fresh
 *   job-seeker" of the Section 13 script, and completing a challenge live is
 *   what fires the notification in step 5.
 * - Kalkidan scores well but has opt_in_discoverable = false, so the opt-in rule
 *   is demonstrable rather than merely claimed.
 * - Kaliti's posting is a transition role with an already-reviewed Continuity
 *   Brief, so Pillar 3b works without waiting on Dev 2.
 */

const T0 = "2026-07-24T06:00:00.000Z";
const T1 = "2026-07-24T09:30:00.000Z";

function jobSeeker(
  id: string,
  full_name: string,
  region: string,
  bio: string,
  opt_in_discoverable: boolean,
): Profile {
  return {
    id,
    role: "job_seeker",
    full_name,
    bio,
    phone: null,
    region,
    created_at: T0,
    opt_in_discoverable,
    is_seed: true,
  };
}

function sme(id: string, full_name: string): Profile {
  return {
    id,
    role: "sme",
    full_name,
    bio: null,
    phone: null,
    region: "Addis Ababa",
    created_at: T0,
    opt_in_discoverable: false,
    is_seed: true,
  };
}

function score(
  user_id: string,
  node_id: string,
  scores_json: ScoreMap,
): SandboxScore {
  return {
    id: `score-${user_id}-${node_id}`,
    user_id,
    node_id,
    scores_json,
    mode: "standard",
    completed_at: T1,
  };
}

function badge(user_id: string, node_id: string, badge_name: string): Badge {
  return {
    id: `badge-${user_id}-${node_id}`,
    user_id,
    node_id,
    badge_name,
    awarded_at: T1,
  };
}

const profiles: Profile[] = [
  jobSeeker(
    "js-selam",
    "Selam Getachew",
    "Addis Ababa",
    "Management graduate, comfortable writing in Amharic and English, looking for a first role where she can use AI tools.",
    true,
  ),
  jobSeeker(
    "js-dawit",
    "Dawit Bekele",
    "Addis Ababa",
    "Worked two years in a family shop, taught himself spreadsheets, wants to move into an operations role.",
    true,
  ),
  jobSeeker(
    "js-marta",
    "Marta Alemu",
    "Bishoftu",
    "Coordinated deliveries for a small produce trader, strong under pressure when plans change.",
    true,
  ),
  jobSeeker(
    "js-kalkidan",
    "Kalkidan Tesfaye",
    "Addis Ababa",
    "Strong scores across the board but currently employed and not open to being matched.",
    false,
  ),
  jobSeeker(
    "js-biruk",
    "Biruk Haile",
    "Adama",
    "Recent IT diploma, quick with AI tools, still building business communication skills.",
    true,
  ),
  jobSeeker(
    "js-rahel",
    "Rahel Girma",
    "Addis Ababa",
    "Ran a small online resale page, writes well to customers, learning structured data work.",
    true,
  ),
  jobSeeker(
    "js-nahom",
    "Nahom Assefa",
    "Addis Ababa",
    "Kept stock records for a hardware supplier, precise with numbers.",
    true,
  ),
  jobSeeker(
    "js-meron",
    "Meron Tadesse",
    "Hawassa",
    "Just finished her intake conversation, has not attempted a challenge yet.",
    true,
  ),
  sme("sme-yeka", "Yeka Fabrics"),
  sme("sme-bole", "Bole Gadgets"),
  sme("sme-kaliti", "Kaliti Fresh Produce"),
];

const companyProfiles: CompanyProfile[] = [
  {
    id: "cp-yeka",
    sme_id: "sme-yeka",
    company_name: "Yeka Fabrics",
    industry: "Textiles & fabric wholesale",
    size: "12 employees",
    logo_url: null,
    about:
      "A fabric wholesaler supplying tailors across Addis Ababa. We moved order-taking from phone calls to WhatsApp last year and now want someone who can run that channel with AI support instead of hiring three people to answer messages.",
    verified: true,
    created_at: T0,
  },
  {
    id: "cp-bole",
    sme_id: "sme-bole",
    company_name: "Bole Gadgets",
    industry: "Retail electronics",
    size: "6 employees",
    logo_url: null,
    about:
      "A phone-accessory shop that outgrew paper stock records. We started using AI to draft restock lists and product descriptions, and we need an assistant who can keep that system honest.",
    verified: true,
    created_at: T0,
  },
  {
    id: "cp-kaliti",
    sme_id: "sme-kaliti",
    company_name: "Kaliti Fresh Produce",
    industry: "Agritech & distribution",
    size: "20 employees",
    logo_url: null,
    about:
      "We move vegetables from cooperative farms to restaurants and hotels in Addis Ababa. Our delivery coordinator resigned last week and most of what she knew was never written down.",
    verified: false,
    created_at: T0,
  },
];

const skillMatrices: SkillMatrix[] = [
  {
    id: "sm-selam",
    user_id: "js-selam",
    skills_json: {
      technical: { ai_prompt_literacy: 55, data_tools: 40 },
      human: { customer_comms: 72, adaptability: 68, process_thinking: 50 },
      raw_notes:
        "Comfortable drafting messages in Amharic and English. Has used AI chat tools for coursework but never for a business task.",
    },
    readiness_score: 58,
    created_at: T1,
    embedding: null,
  },
  {
    id: "sm-meron",
    user_id: "js-meron",
    skills_json: {
      technical: { ai_prompt_literacy: 42, data_tools: 58 },
      human: { customer_comms: 60, adaptability: 55, process_thinking: 62 },
      raw_notes:
        "Kept records for a family agriculture business, wants structured office work.",
    },
    readiness_score: 51,
    created_at: T1,
    embedding: null,
  },
];

const sandboxScores: SandboxScore[] = [
  score("js-dawit", "merkato-whatsapp-catalog", {
    ai_prompt_literacy: 78,
    customer_comms: 71,
    task_accuracy: 69,
  }),
  score("js-dawit", "retail-inventory-tracker", {
    data_tools: 74,
    task_accuracy: 72,
    ai_prompt_literacy: 76,
  }),
  score("js-marta", "agritech-delivery-schedule", {
    process_thinking: 81,
    task_accuracy: 73,
    adaptability: 79,
  }),
  score("js-marta", "merkato-whatsapp-catalog", {
    ai_prompt_literacy: 68,
    customer_comms: 74,
    task_accuracy: 70,
  }),
  score("js-kalkidan", "retail-inventory-tracker", {
    data_tools: 88,
    task_accuracy: 84,
    ai_prompt_literacy: 86,
  }),
  score("js-kalkidan", "merkato-whatsapp-catalog", {
    ai_prompt_literacy: 85,
    customer_comms: 82,
    task_accuracy: 80,
  }),
  score("js-biruk", "merkato-whatsapp-catalog", {
    ai_prompt_literacy: 79,
    customer_comms: 58,
    task_accuracy: 66,
  }),
  score("js-rahel", "merkato-whatsapp-catalog", {
    ai_prompt_literacy: 72,
    customer_comms: 86,
    task_accuracy: 71,
  }),
  score("js-nahom", "retail-inventory-tracker", {
    data_tools: 82,
    task_accuracy: 76,
    ai_prompt_literacy: 64,
  }),
];

const badges: Badge[] = [
  badge("js-dawit", "merkato-whatsapp-catalog", "AI Catalog Builder"),
  badge("js-dawit", "retail-inventory-tracker", "Inventory Systems Designer"),
  badge("js-marta", "agritech-delivery-schedule", "Operations Planner"),
  badge("js-marta", "merkato-whatsapp-catalog", "AI Catalog Builder"),
  badge("js-kalkidan", "retail-inventory-tracker", "Inventory Systems Designer"),
  badge("js-kalkidan", "merkato-whatsapp-catalog", "AI Catalog Builder"),
  badge("js-biruk", "merkato-whatsapp-catalog", "AI Catalog Builder"),
  badge("js-rahel", "merkato-whatsapp-catalog", "AI Catalog Builder"),
  badge("js-nahom", "retail-inventory-tracker", "Inventory Systems Designer"),
];

const templates: RoleSkillTemplate[] = [
  {
    id: "tpl-catalog",
    sme_id: "sme-yeka",
    role_name: "AI Sales Assistant (WhatsApp)",
    // A junior WhatsApp sales bar, and the template the Section 13 demo clears
    // live. Kept reachable on a genuinely good first attempt so the notification
    // beat does not depend on the operator over-performing on stage.
    thresholds_json: { ai_prompt_literacy: 70, customer_comms: 70 },
    notify_on_match: true,
    created_at: T0,
  },
  {
    id: "tpl-inventory",
    sme_id: "sme-bole",
    role_name: "Retail Inventory Assistant",
    thresholds_json: {
      data_tools: 70,
      ai_prompt_literacy: 75,
      customer_comms: 65,
    },
    notify_on_match: true,
    created_at: T0,
  },
  {
    id: "tpl-dispatch",
    sme_id: "sme-kaliti",
    role_name: "Delivery Coordinator",
    thresholds_json: {
      process_thinking: 70,
      adaptability: 65,
      task_accuracy: 70,
    },
    notify_on_match: true,
    created_at: T0,
  },
];

const postings: SmePosting[] = [
  {
    id: "post-catalog",
    sme_id: "sme-yeka",
    template_id: "tpl-catalog",
    description:
      "Run our WhatsApp order channel with AI support: keep the fabric catalog current, answer tailors quickly, and flag out-of-stock lines before a customer finds out.",
    is_transition_role: false,
    status: "open",
    created_at: T0,
    embedding: null,
  },
  {
    id: "post-inventory",
    sme_id: "sme-bole",
    template_id: "tpl-inventory",
    description:
      "Own the stock sheet for phone accessories, run the reorder rule daily, and keep the shop assistant's instructions current.",
    is_transition_role: false,
    status: "open",
    created_at: T0,
    embedding: null,
  },
  {
    id: "post-dispatch",
    sme_id: "sme-kaliti",
    template_id: "tpl-dispatch",
    description:
      "Coordinate two vans delivering to eight restaurants and two hotels. Our previous coordinator resigned; this is a transition role with a handover brief.",
    is_transition_role: true,
    status: "open",
    created_at: T0,
    embedding: null,
  },
];

const continuityBriefs: ContinuityBrief[] = [
  {
    id: "brief-dispatch",
    posting_id: "post-dispatch",
    raw_interview_json: {
      role_title: "Delivery Coordinator",
      recurring_tasks: [
        "Confirm farm arrival quantities by 5:30am and reconcile against yesterday's orders",
        "Split the two vans across eight restaurants and two hotels before 6am loading",
        "Call the hotel by 4pm to confirm tomorrow's quantity, which changes most days",
        "Log spoilage at the end of the day and decide what gets discounted or dropped",
      ],
      tools: [
        "Shared spreadsheet for daily orders",
        "WhatsApp groups per customer",
        "Paper delivery notes signed by drivers",
      ],
      shortcuts: [
        "Load the hotel order last so it comes off first, because their gate closes at 7am",
        "Never promise leafy greens on the second van in the afternoon",
      ],
      coordinates_with: [
        "Two van drivers",
        "Farm liaison at the cooperative",
        "Kitchen managers at the two hotels",
      ],
      notes:
        "Employee reviewed and redacted this brief before saving; specific client contact names were removed.",
    },
    generated_brief:
      "The Delivery Coordinator role runs a fixed morning cycle: reconcile farm arrivals against the previous day's orders before 5:30am, allocate two vans across ten customers before 6am loading, and confirm the largest hotel's next-day quantity each afternoon because it changes with little notice. Priority when capacity is short is the hotel gate closing at 7am, then restaurants by delivery distance. End of day means logging spoilage and deciding discounts on produce that will not survive another day. The role coordinates continuously with two drivers, the cooperative's farm liaison, and hotel kitchen managers, mostly over WhatsApp and a shared order spreadsheet.",
    custom_node_id: null,
    reviewed_by_employee: true,
    created_at: T1,
  },
];

const matches: Match[] = [];
const notifications: Notification[] = [];

export type SeedData = {
  profiles: Profile[];
  companyProfiles: CompanyProfile[];
  skillMatrices: SkillMatrix[];
  sandboxScores: SandboxScore[];
  badges: Badge[];
  templates: RoleSkillTemplate[];
  postings: SmePosting[];
  continuityBriefs: ContinuityBrief[];
  matches: Match[];
  notifications: Notification[];
};

/** Fresh deep copy so a reset always returns the same known-good dataset. */
export function seedData(): SeedData {
  return structuredClone({
    profiles,
    companyProfiles,
    skillMatrices,
    sandboxScores,
    badges,
    templates,
    postings,
    continuityBriefs,
    matches,
    notifications,
  });
}

export const DEFAULT_JOB_SEEKER_ID = "js-selam";
export const DEFAULT_SME_ID = "sme-yeka";
