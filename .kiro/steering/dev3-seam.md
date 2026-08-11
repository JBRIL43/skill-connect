---
inclusion: fileMatch
fileMatchPattern: ['lib/sandbox/**', 'lib/ai/**', 'lib/matcher/**', 'lib/data/**', 'app/sandbox/**', 'app/matcher/**', 'app/company-profile/**', 'app/api/sandbox/**', 'components/sandbox/**', 'components/matcher/**']
---

# The Dev 3 seam

## Never reach past the repository layer

Components and route handlers go through `lib/data` (the repository interface), never
straight to Supabase. That is what keeps the mock and supabase adapters swappable, so
every surface stays demoable with `NEXT_PUBLIC_DATA_SOURCE=mock` when the database is
unreachable or the schema is mid-migration.

## Pick the right client, or RLS will lie to you

`0002_rls_policies.sql` grants an SME **no read at all** on `sandbox_scores` or on
another user's `profiles` row. RLS denies rather than errors, so the wrong client
returns an empty array and looks exactly like a scoring bug.

Use the request-scoped client from `lib/supabase/server.ts` for anything the signed-in
user owns: their own scores and badges, their own templates and postings, their own
matches, notifications, and company profile.

Use `createAdminClient()` from `lib/supabase/admin.ts` for the three cross-user
operations, all of them server-only:

- the post-grade notification check, which reads every SME's `role_skill_templates`
- the match run, which reads candidates' scores and `opt_in_discoverable`
- writing `continuity_briefs.custom_node_id`, since that table has no write policy

The service role bypasses RLS completely. It never gets imported into a client
component, and it never runs on a path a signed-out visitor can reach.

## Never hardcode a competency key

Import from `lib/sandbox/competencies.ts`. `sandbox_scores.scores_json` and
`role_skill_templates.thresholds_json` must use the same frozen vocabulary or the match
engine silently returns nothing — the exact failure this rule exists to prevent.

## Never call an LLM provider directly

Go through `lib/ai/*` so `AI_MODE=stub` keeps grading, assistant replies, template
drafting, gap analysis, and challenge generation working without an API key. That
fallback is in the risk register for a reason: a rate-limited provider mid-demo.

## Opt-in is not a UI concern

A candidate's scores may only count toward an SME's results when
`profiles.opt_in_discoverable` is true. Filter it server-side. `sme_has_match_with()`
enforces it in the database too, but do not rely on the database to cover a query that
should never have been written.

## SMEs see derived output only

Match score, gap analysis text, and badges. Never raw intake transcripts, never
`skill_matrices`, never an unreviewed continuity brief.
