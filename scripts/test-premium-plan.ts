/**
 * Checks the rule that decides who gets notified.
 *
 *   npm run test:plan
 *
 * templatesWithinPlan is the whole of the premium gate. It runs on the hot path
 * of every graded challenge, it decides what an SME is paying for, and getting
 * it wrong is quiet in both directions: too strict and a paying customer stops
 * being told about candidates, too loose and the upsell in Section 6 is free.
 * Neither shows up as an error anywhere.
 */

import { FREE_NOTIFY_TEMPLATE_LIMIT } from "../lib/payments/config";
import { templatesWithinPlan } from "../lib/payments/plan";

let failed = 0;

function check(name: string, condition: boolean, detail?: string) {
  if (condition) {
    console.log(`  PASS  ${name}`);
  } else {
    console.log(`  FAIL  ${name}`);
    if (detail) console.log(`        ${detail}`);
    failed += 1;
  }
}

const template = (sme_id: string, created_at: string, id: string) => ({
  sme_id,
  created_at,
  id,
});

const ids = (rows: { id: string }[]) => rows.map((row) => row.id).join(",");

console.log("\nThe free plan");

const threeFree = [
  template("sme-a", "2026-07-01T10:00:00Z", "first"),
  template("sme-a", "2026-07-02T10:00:00Z", "second"),
  template("sme-a", "2026-07-03T10:00:00Z", "third"),
];

const free = templatesWithinPlan(threeFree, new Set());

check(
  `keeps exactly ${FREE_NOTIFY_TEMPLATE_LIMIT}`,
  free.length === FREE_NOTIFY_TEMPLATE_LIMIT,
  `kept ${free.length}: ${ids(free)}`,
);

check("keeps the oldest, not the newest", free[0]?.id === "first", ids(free));

// Order of arrival must not matter: the database is free to return rows in any
// order it likes, and it does.
const shuffled = templatesWithinPlan(
  [threeFree[2], threeFree[0], threeFree[1]],
  new Set(),
);

check(
  "is stable however the rows arrive",
  shuffled[0]?.id === "first",
  ids(shuffled),
);

console.log("\nPaying lifts the cap");

const paid = templatesWithinPlan(threeFree, new Set(["sme-a"]));

check("a premium SME keeps all of them", paid.length === 3, ids(paid));

console.log("\nThe allowance is per company, not global");

const mixed = [
  template("sme-a", "2026-07-01T10:00:00Z", "a1"),
  template("sme-b", "2026-07-01T11:00:00Z", "b1"),
  template("sme-a", "2026-07-02T10:00:00Z", "a2"),
  template("sme-b", "2026-07-02T11:00:00Z", "b2"),
  template("sme-c", "2026-07-03T10:00:00Z", "c1"),
];

const perCompany = templatesWithinPlan(mixed, new Set(["sme-b"]));

check(
  "each free company keeps its own oldest",
  perCompany.some((row) => row.id === "a1") &&
    perCompany.some((row) => row.id === "c1"),
  ids(perCompany),
);

check(
  "one company's templates do not consume another's allowance",
  !perCompany.some((row) => row.id === "a2"),
  ids(perCompany),
);

check(
  "the premium company is unaffected by the free ones",
  perCompany.some((row) => row.id === "b1") &&
    perCompany.some((row) => row.id === "b2"),
  ids(perCompany),
);

console.log("\nEdge cases");

check("an empty list stays empty", templatesWithinPlan([], new Set()).length === 0);

check(
  "the input array is not mutated",
  (() => {
    const original = [...threeFree];
    templatesWithinPlan(threeFree, new Set());
    return threeFree.every((row, i) => row === original[i]);
  })(),
);

// Section 13 runs the demo in order: a notification fires at step 5, the upgrade
// only happens at step 7. A limit of zero would break that, silently, on stage.
check(
  "the free limit still covers a company's first template",
  FREE_NOTIFY_TEMPLATE_LIMIT >= 1,
  `limit is ${FREE_NOTIFY_TEMPLATE_LIMIT}, so the demo would fire nothing before the upgrade`,
);

if (failed > 0) {
  console.error(`\n${failed} check(s) failed.`);
  process.exit(1);
}

console.log("\nAll premium plan checks passed.");
