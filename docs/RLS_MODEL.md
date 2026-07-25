# The Skill-Connect security model, in plain English

This is the one-page summary of `supabase/migrations/0002_rls_policies.sql`, and
the script for the technical deep-dive with Ethio Telecom's judges.

## The claim

Skill-Connect is credible to a company because its scores are graded, not
self-reported. That only works if candidates trust us with the conversation that
produced those scores — and an intake chat surfaces things a job application
never would: a family situation, a disability, why someone is job-hunting right
now.

So the platform is built around one boundary: **a company sees what a candidate
can do, never what a candidate said.**

That boundary is enforced in Postgres with Row Level Security, not in React. If
someone bypasses our UI entirely and queries the database with a stolen anon key
and a valid candidate session, the rules below still hold.

## What each role can reach

| Table | Job seeker | Company (SME) | Admin |
| --- | --- | --- | --- |
| `profiles` | Own row, read and write | Own row only | All rows |
| `skill_matrices` | Own rows | **Nothing. No exception.** | All rows |
| `sandbox_scores` | Own rows | **Nothing. No exception.** | All rows |
| `badges` | Own rows | Only for a candidate who opted in *and* already matched to one of their own postings | All rows |
| `company_profiles` | Public read | Public read, writes own | Can flip `verified` |
| `role_skill_templates` | Nothing | Own templates only | All rows |
| `sme_postings` | Open postings, read only | Full control of own | All rows |
| `continuity_briefs` | Nothing | Own posting **and** reviewed by the employee | All rows |
| `matches` | Own rows | Own postings only | All rows |
| `notifications` | Nothing | Own notifications | All rows |
| `payments` | Nothing | Own payments, read only | All rows |

## The four decisions worth explaining out loud

**1. Companies cannot read `skill_matrices` or `sandbox_scores` at all.**

Not filtered, not redacted — no policy grants them access, and a table with RLS
enabled denies anything no policy allows. A company's only window onto a
candidate is the `matches` table, which physically holds just three derived
columns: `match_score`, `gap_analysis`, and `status`. RLS filters rows rather
than columns, so instead of trying to hide columns we built a table that has no
sensitive column to hide.

**2. Opt-in is enforced inside the database, not in the query we happened to
write.**

`sme_has_match_with()` checks `profiles.opt_in_discoverable` itself. A candidate
who has not opted in cannot be surfaced to a company even by a buggy or
malicious query, because the permission function refuses before the query runs.

**3. Continuity briefs are double-gated.**

A brief is readable only when the caller owns the linked posting *and*
`reviewed_by_employee` is true. Until the outgoing employee has read the brief
and removed anything sensitive, it is invisible to the company that requested
it. That flag is load-bearing, not a UI checkbox.

**4. Nobody can promote themselves to admin.**

The insert policy on `profiles` rejects `role = 'admin'` outright, and the
signup trigger rewrites any role it does not recognise to `job_seeker`. Admin is
granted out of band — either in Supabase Studio or through `/admin/promote`,
which runs with the service role after checking a shared invite code.

## Why the helper functions are `SECURITY DEFINER`

A policy on `profiles` that queries `profiles` recurses forever. `is_admin()`,
`owns_posting()`, and `sme_has_match_with()` run as the definer to break that
cycle. Each pins `search_path = public` so a caller cannot shadow `public` with
their own schema and change what the function resolves to, and each is revoked
from `public` and granted only to `authenticated`.

## How to verify it

Run these as QA before demo freeze, twice — once mid-build and once on the final
schema, because policy drift is real.

1. Sign in as job seeker A. Query job seeker B's `skill_matrices` and
   `sandbox_scores` directly. Both must return zero rows.
2. Sign in as a company. Query `skill_matrices` for a candidate who already
   matched to one of your postings. Must return zero rows.
3. Sign in as a company. Query `continuity_briefs` for your own transition
   posting before the employee has reviewed it. Must return zero rows.
4. Sign in as a company. Query `notifications` and `payments` belonging to
   another company. Must return zero rows.

Anything that returns data here is a P0 and stops the build.
