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

That last one is worth telling honestly, because our first version was wrong.
RLS decides which *rows* you can touch, not which *columns*. The update policy
correctly limited a user to their own profile row — but nothing stopped them
from setting `role = 'admin'` on it. A single PATCH request was a route to the
admin console.

The fix in `0005_column_grants.sql` is a Postgres column grant rather than
another policy:

```sql
revoke update on public.profiles from authenticated, anon;
grant update (full_name, bio, phone, region, opt_in_discoverable)
  on public.profiles to authenticated;
```

Row security and column security are different tools and you need both. The
same pattern now protects `matches.match_score` and `matches.gap_analysis`, so
an SME can drive the shortlist/hire action without being able to rewrite the
score the engine gave a candidate.

## Why the helper functions are `SECURITY DEFINER`

A policy on `profiles` that queries `profiles` recurses forever. `is_admin()`,
`owns_posting()`, and `sme_has_match_with()` run as the definer to break that
cycle. Each pins `search_path = public` so a caller cannot shadow `public` with
their own schema and change what the function resolves to, and each is revoked
from `public` and granted only to `authenticated`.

## How to verify it

```powershell
.\scripts\test-rls.ps1
```

The suite signs in as a real job seeker, a second job seeker, and an SME, then
queries the database directly over the REST API — bypassing our UI entirely, the
way an attacker would. It checks that a candidate can read their own matrix and
scores, that neither another candidate nor an SME nor an anonymous caller can,
that public surfaces like company profiles still work, and that a job seeker
cannot PATCH themselves to admin.

Run it after every migration and again at demo freeze. Policy drift is real, and
a table added at 3am is exactly how a leak gets in. Any FAIL is a P0 that stops
the build.

Two cases the script does not yet cover, because they need data that does not
exist until Dev 3's match engine and Dev 2's handover flow land:

- An SME querying `continuity_briefs` for their own transition posting before
  the employee has reviewed it. Must return zero rows.
- An SME querying `notifications` or `payments` belonging to another company.
  Must return zero rows.

Add both to the script once those tables have rows.
