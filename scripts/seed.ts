/**
 * Loads supabase/seed/*.json into the linked Supabase project.
 *
 *   npm run seed
 *
 * The same code path as the "Seed demo data" button in the admin console, minus
 * the browser. This exists so the demo dataset is reproducible from the repo:
 * if the project is reset, or a teammate points .env.local at their own
 * Supabase, one command rebuilds it.
 *
 * Safe to run repeatedly. Every row is keyed by a UUID derived from the
 * persona's `key`, so a second run updates the same rows rather than inserting
 * a parallel set.
 */

import { runSeed } from "../lib/seed/run";

async function main() {
  const target = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!target) {
    console.error(
      "NEXT_PUBLIC_SUPABASE_URL is not set. Run this through `npm run seed`, " +
        "which loads .env.local.",
    );
    process.exit(1);
  }

  console.log(`Seeding ${target}\n`);

  const summary = await runSeed();

  console.log(`  job seekers        ${summary.jobSeekers}`);
  console.log(`  companies          ${summary.smes}`);
  console.log(`  role templates     ${summary.templates}`);
  console.log(`  postings           ${summary.postings}`);
  console.log(`  graded challenges  ${summary.scores}`);

  if (summary.errors.length > 0) {
    console.error(`\n${summary.errors.length} persona(s) failed:`);
    for (const error of summary.errors) console.error(`  - ${error}`);
    process.exit(1);
  }

  console.log("\nDone. Running it again updates the same rows.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
