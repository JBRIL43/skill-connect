import jobSeekerFile from "@/supabase/seed/seed-job-seekers.json";
import smeFile from "@/supabase/seed/seed-smes.json";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  SEED_PASSWORD,
  seedId,
  type SeedJobSeeker,
  type SeedJobSeekerFile,
  type SeedSme,
  type SeedSmeFile,
} from "./contract";

/**
 * Loads supabase/seed/*.json into the live database.
 *
 * This is the demo's safety net: if a live signup or a grading call fails on
 * stage, one click restores a populated platform. So it has to be safe to press
 * repeatedly — every row is keyed by a UUID derived from the persona's `key`
 * and written with upsert, meaning a second press updates rather than
 * duplicates. Seeded rows carry profiles.is_seed = true.
 */

export type SeedSummary = {
  jobSeekers: number;
  smes: number;
  templates: number;
  postings: number;
  scores: number;
  errors: string[];
};

type Admin = ReturnType<typeof createAdminClient>;

/**
 * A write that fails quietly here is worse than one that fails loudly: the
 * button would report success while the demo stayed empty. Every write goes
 * through this so the persona's error lands in the summary instead.
 */
async function must<T extends { error: { message: string } | null }>(
  what: string,
  query: PromiseLike<T>,
) {
  const result = await query;
  if (result.error) throw new Error(`${what}: ${result.error.message}`);
  return result;
}

/**
 * profiles.id is a foreign key onto auth.users, so a persona needs a real auth
 * user before anything else can reference it. Their email is the natural key:
 * create on the first run, look up on every run after.
 */
async function ensureAuthUser(
  admin: Admin,
  email: string,
  metadata: Record<string, unknown>,
) {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: SEED_PASSWORD,
    email_confirm: true,
    user_metadata: metadata,
  });

  if (!error && data.user) return data.user.id;

  const { data: list, error: listError } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });

  if (listError) throw new Error(`${email}: ${listError.message}`);

  const existing = list.users.find(
    (user) => user.email?.toLowerCase() === email.toLowerCase(),
  );

  if (!existing) {
    throw new Error(`${email}: ${error?.message ?? "could not create or find user"}`);
  }

  return existing.id;
}

async function seedJobSeeker(admin: Admin, person: SeedJobSeeker) {
  const userId = await ensureAuthUser(admin, person.email, {
    role: "job_seeker",
    full_name: person.full_name,
    phone: person.phone ?? "",
    region: person.region ?? "",
  });

  // The signup trigger already inserted the profile row; fill in the rest.
  await must(
    "profile",
    admin
      .from("profiles")
      .update({
        full_name: person.full_name,
        bio: person.bio ?? null,
        phone: person.phone ?? null,
        region: person.region ?? null,
        opt_in_discoverable: person.opt_in_discoverable ?? false,
        is_seed: true,
      })
      .eq("id", userId),
  );

  if (person.skills || person.readiness_score !== undefined) {
    await must(
      "skill matrix",
      admin.from("skill_matrices").upsert({
        id: seedId("matrix", person.key),
        user_id: userId,
        skills_json: person.skills ?? {},
        readiness_score: person.readiness_score ?? null,
      }),
    );
  }

  const scores = person.sandbox_scores ?? [];
  if (scores.length > 0) {
    await must(
      "sandbox scores",
      admin.from("sandbox_scores").upsert(
        scores.map((score) => ({
          id: seedId("score", person.key, score.node_id),
          user_id: userId,
          node_id: score.node_id,
          scores_json: score.scores,
          mode: score.mode ?? "standard",
        })),
      ),
    );
  }

  const badges = person.badges ?? [];
  if (badges.length > 0) {
    await must(
      "badges",
      admin.from("badges").upsert(
        badges.map((badge) => ({
          id: seedId("badge", person.key, badge.node_id),
          user_id: userId,
          node_id: badge.node_id,
          badge_name: badge.badge_name,
        })),
        { onConflict: "user_id,node_id" },
      ),
    );
  }

  return scores.length;
}

async function seedSme(admin: Admin, company: SeedSme) {
  const userId = await ensureAuthUser(admin, company.email, {
    role: "sme",
    full_name: company.contact_name,
    company_name: company.company_name,
    phone: company.phone ?? "",
    region: company.region ?? "",
  });

  await must(
    "profile",
    admin
      .from("profiles")
      .update({
        full_name: company.contact_name,
        phone: company.phone ?? null,
        region: company.region ?? null,
        is_seed: true,
      })
      .eq("id", userId),
  );

  // company_profiles.sme_id is unique, so it is the conflict target rather than
  // a derived id — the signup trigger may already have created this row.
  await must(
    "company profile",
    admin.from("company_profiles").upsert(
      {
        sme_id: userId,
        company_name: company.company_name,
        industry: company.industry ?? null,
        size: company.size ?? null,
        about: company.about ?? null,
        verified: company.verified ?? false,
      },
      { onConflict: "sme_id" },
    ),
  );

  const templates = company.templates ?? [];
  if (templates.length > 0) {
    await must(
      "templates",
      admin.from("role_skill_templates").upsert(
        templates.map((template) => ({
          id: seedId("template", company.key, template.key),
          sme_id: userId,
          role_name: template.role_name,
          thresholds_json: template.thresholds,
          notify_on_match: template.notify_on_match ?? true,
        })),
      ),
    );
  }

  const postings = company.postings ?? [];
  if (postings.length > 0) {
    await must(
      "postings",
      admin.from("sme_postings").upsert(
        postings.map((posting) => ({
          id: seedId("posting", company.key, posting.key),
          sme_id: userId,
          template_id: posting.template_key
            ? seedId("template", company.key, posting.template_key)
            : null,
          description: posting.description ?? null,
          is_transition_role: posting.is_transition_role ?? false,
          status: posting.status ?? "open",
        })),
      ),
    );
  }

  return { templates: templates.length, postings: postings.length };
}

export async function runSeed(): Promise<SeedSummary> {
  const admin = createAdminClient();
  const seekers = (jobSeekerFile as SeedJobSeekerFile).job_seekers ?? [];
  const companies = (smeFile as SeedSmeFile).smes ?? [];

  const summary: SeedSummary = {
    jobSeekers: 0,
    smes: 0,
    templates: 0,
    postings: 0,
    scores: 0,
    errors: [],
  };

  // Companies first: a template has to exist before a candidate's scores can be
  // checked against it.
  for (const company of companies) {
    try {
      const counts = await seedSme(admin, company);
      summary.smes += 1;
      summary.templates += counts.templates;
      summary.postings += counts.postings;
    } catch (error) {
      summary.errors.push(
        `${company.key}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  for (const person of seekers) {
    try {
      summary.scores += await seedJobSeeker(admin, person);
      summary.jobSeekers += 1;
    } catch (error) {
      summary.errors.push(
        `${person.key}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  return summary;
}
