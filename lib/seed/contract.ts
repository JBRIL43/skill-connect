import { createHash } from "node:crypto";

/**
 * The shape of supabase/seed/*.json.
 *
 * These files exist so the demo has a populated platform even if nobody has
 * clicked through a live signup, and so the non-technical lead can write real
 * Ethiopian personas without touching code. Keep the contract stable: the
 * admin console's seed button parses exactly this.
 */

export type SeedSandboxScore = {
  node_id: string;
  mode?: "standard" | "pressure_simulation";
  scores: Record<string, number>;
};

export type SeedJobSeeker = {
  /** Stable slug. Changing it creates a second persona rather than editing this one. */
  key: string;
  full_name: string;
  email: string;
  phone?: string;
  region?: string;
  bio?: string;
  opt_in_discoverable?: boolean;
  readiness_score?: number;
  skills?: { technical?: Record<string, number>; human?: Record<string, number> };
  sandbox_scores?: SeedSandboxScore[];
  badges?: { node_id: string; badge_name: string }[];
};

export type SeedTemplate = {
  key: string;
  role_name: string;
  notify_on_match?: boolean;
  /** competency -> minimum score out of 100 */
  thresholds: Record<string, number>;
};

export type SeedPosting = {
  key: string;
  template_key?: string;
  description?: string;
  is_transition_role?: boolean;
  status?: "open" | "filled";
};

export type SeedSme = {
  key: string;
  company_name: string;
  contact_name: string;
  email: string;
  phone?: string;
  region?: string;
  industry?: string;
  size?: string;
  about?: string;
  verified?: boolean;
  templates?: SeedTemplate[];
  postings?: SeedPosting[];
};

export type SeedJobSeekerFile = { version: number; job_seekers: SeedJobSeeker[] };
export type SeedSmeFile = { version: number; smes: SeedSme[] };

/** Every seeded login uses this, so the demo can sign in as any persona. */
export const SEED_PASSWORD = "Test1234!";

// Arbitrary but fixed. Changing it would repoint every derived id and the seed
// button would start creating duplicates instead of updating in place.
const NAMESPACE = "6f1d2c48-3a5e-4b7c-9d80-2e5f4a1b8c33";

/**
 * Turns a seed key into the same UUID every time, so the button can upsert by
 * primary key. That is what makes clicking it twice safe — the second click
 * overwrites the same rows rather than inserting a parallel set.
 */
export function seedId(...parts: string[]) {
  const namespaceBytes = Buffer.from(NAMESPACE.replace(/-/g, ""), "hex");
  const digest = createHash("sha1")
    .update(Buffer.concat([namespaceBytes, Buffer.from(parts.join(":"), "utf8")]))
    .digest();

  const bytes = Buffer.from(digest.subarray(0, 16));
  bytes[6] = (bytes[6] & 0x0f) | 0x50; // version 5
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // RFC 4122 variant

  const hex = bytes.toString("hex");
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20),
  ].join("-");
}
