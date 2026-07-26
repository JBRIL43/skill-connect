# Dev 3 Contracts — Sandbox & SME Matcher

Owner: Dev 3. Everything in this file is a hand-off other people are blocked on.
If you need a change here, tell Dev 3 rather than working around it locally.

---

## 1. Frozen competency vocabulary

The spec gives two different score vocabularies. Section 2 shows a Sandbox Score
as `prompt_engineering / task_accuracy / communication`, and the Role Skill
Template example uses `excel_basics / ai_prompt_literacy / customer_comms`. The
match engine compares `sandbox_scores.scores_json` against
`role_skill_templates.thresholds_json` key by key, so two vocabularies means
every candidate clears zero thresholds and the Pillar 3 demo shows an empty list.

These six keys are the reconciliation. Source of truth:
[lib/sandbox/competencies.ts](../lib/sandbox/competencies.ts).

| Key | Label | Amharic (provisional) | Replaces / covers |
| --- | --- | --- | --- |
| `ai_prompt_literacy` | AI prompt literacy | የ AI አጠቃቀም ክህሎት | `prompt_engineering` |
| `task_accuracy` | Task accuracy | የሥራ ትክክለኛነት | — |
| `customer_comms` | Customer communication | የደንበኛ ግንኙነት | `communication` |
| `data_tools` | Data & spreadsheet tools | የመረጃ መሣሪያዎች | `excel_basics` |
| `process_thinking` | Process thinking | የሥራ ሂደት አስተሳሰብ | — |
| `adaptability` | Adaptability | ተለዋዋጭነት | — |

Scores are integers 0-100. Unknown keys are dropped by `normalizeScores()`, so a
persona or an LLM response using `excel_basics` silently loses that score.

Non-technical lead: the Amharic column is provisional. Correct the wording and
hand it back — the keys stay, only labels change.

---

## 2. Sandbox node registry

Source of truth: [lib/sandbox/nodes.ts](../lib/sandbox/nodes.ts). Deep link for
any challenge is `/sandbox/<node_id>`.

| `node_id` | Sector | Competencies scored (weight) | Badge awarded |
| --- | --- | --- | --- |
| `merkato-whatsapp-catalog` | textiles | `ai_prompt_literacy` (0.40), `customer_comms` (0.35), `task_accuracy` (0.25) | AI Catalog Builder |
| `retail-inventory-tracker` | retail | `data_tools` (0.40), `task_accuracy` (0.30), `ai_prompt_literacy` (0.30) | Inventory Systems Designer |
| `agritech-delivery-schedule` | agritech | `process_thinking` (0.40), `task_accuracy` (0.30), `adaptability` (0.30) | Operations Planner |

Prerequisite chain: `merkato-whatsapp-catalog` → `retail-inventory-tracker` →
`agritech-delivery-schedule`. Prerequisites are advisory in the UI, not locks —
nothing blocks the demo if a challenge is opened out of order.

Pillar 3b generates additional nodes at runtime with ids shaped
`transition-<postingId>`, stored on `continuity_briefs.custom_node_id`. They are
not in the static registry and are resolved through the data layer.

**Dev 2:** these three ids are what career recommendations should link to (owed
by Hour 14). `nodesForCompetency()` in the registry maps a weak competency in a
skill matrix to the challenges that train it.

**Non-technical lead:** these are the three sectors in play, so job-seeker
personas should cluster in textiles, retail, and agritech.

---

## 3. Seed data shapes

`sandbox_scores.scores_json` — subset of the frozen keys, integers 0-100:

```json
{ "ai_prompt_literacy": 82, "customer_comms": 88, "task_accuracy": 74 }
```

`role_skill_templates.thresholds_json` — same keys, minimum score to qualify:

```json
{ "data_tools": 70, "ai_prompt_literacy": 75, "customer_comms": 65 }
```

`skill_matrices.skills_json` (Dev 2 owns this shape; Dev 3 reads it only as a
semantic ranking signal, never as a threshold):

```json
{
  "technical": { "ai_prompt_literacy": 60, "data_tools": 45 },
  "human": { "adaptability": 70, "customer_comms": 65 },
  "raw_notes": "short summary of the intake conversation"
}
```

A candidate needs `profiles.opt_in_discoverable = true` to appear in any match
result. Seed at least a few personas with it set to `false` so the opt-in rule is
demonstrable rather than just claimed.

---

## 4. What Dev 3 needs from others

- **Dev 1** — live schema (Hour 6); confirmation that the field is named exactly
  `opt_in_discoverable` (Hour 10); the `notifications` table wired and the
  `/api/notifications/check` route callable right after grading (Hour 26).
- **Dev 2** — the exact shape of `continuity_briefs.raw_interview_json` (Hour 24)
  and one row with `reviewed_by_employee = true` (Hour 28). Dev 3 reads reviewed
  rows only.
- **Non-technical lead** — seed personas and templates using the frozen keys
  above, and confirmed Amharic labels.

---

## 5. Seam configuration (how to run Dev 3's work with nothing else ready)

Both switches live in `.env.local` (see [.env.example](../.env.example)):

- `NEXT_PUBLIC_DATA_SOURCE=mock` — in-memory fixtures, no Supabase needed.
  Anything else, unset included, is the live schema; only the adapter changes.
  The default is deliberately the real one, so that forgetting the variable on a
  deployment cannot quietly serve fixtures that throw every write away.
- `AI_MODE=stub` — deterministic local grading and generation, no API key needed.
  Switch to `live` for the Vercel AI SDK path once `OPENAI_API_KEY` is set.

`AI_MODE=stub` is also the on-stage fallback: if the LLM is rate-limited during
judging, challenges still grade, badges still pop, and matching still ranks.

Never import Supabase or an LLM provider directly in a component or route —
go through `lib/data` and `lib/ai` so both switches keep working.

---

## 6. Which Supabase client each operation uses

`0002_rls_policies.sql` denies rather than errors, so the wrong client returns an
empty array that reads exactly like a scoring bug. The split in
`lib/data/supabase/adapter.ts`:

| Operation | Client | Why |
| --- | --- | --- |
| own scores, badges, templates, postings, matches, notifications, briefs | session | the caller owns the rows |
| `profiles.opt_in_discoverable` update | session | the candidate's own decision |
| notification check | service role | reads every SME's `role_skill_templates` |
| match run's score and opt-in reads | service role | an SME has no policy on `sandbox_scores` |
| `continuity_briefs.custom_node_id` write | service role | the table has no write policy at all |
| `matches` insert and update | session | `owns_posting()` is tighter than the service role |
| reviewed brief behind a transition challenge | service role | the candidate taking it never owns the posting |
| open transition postings, for the node tree | session | 0002 lets any signed-in user read an open posting |

The service role bypasses RLS entirely, so it stays in route handlers and server
actions and is never imported into a client component.

### Why challenge resolution reads past the brief policy

`continuity_briefs` is scoped to the owning SME, which is right for the brief and
wrong for the challenge derived from it. The candidate replacing the departing
employee is exactly who the challenge is for, and they will never own the
posting — so resolving it through `getBriefByPosting` returned null for them and
the challenge page 404'd. Phase 8's "route incoming candidates to be scored
against this specific challenge" could not work at all except by accident, when
the SME happened to have generated the node in the same process moments earlier.

`getReviewedBriefForChallenge` reads past the policy, and is narrow enough to be
safe for three reasons: `reviewed_by_employee` is still required, so the source
has been through the redaction step; the caller returns a generated `SandboxNode`
and never the brief; and `verify:mock` asserts that the SME-facing brief prose and
the internal review note do not reach the candidate's page, while the real
recurring tasks do, which is the Section 2 point 4 feature rather than a leak.

One caveat on that coverage, stated plainly because it matters: mock mode has no
RLS, so those checks prove the cold-cache half of this and not the policy half. A
mutation run confirms the node-tree check fails when the tree is derived from the
in-process memo again, but the candidate-can-open check passes either way in mock.
Proving the policy half needs `verify:flows` against live Supabase with a job
seeker session, which is the one gap left in this area.

---

## 7. Open items for Dev 1

**1. ~~An SME has no way to see who a candidate is~~ — solved by Dev 1 in
`0006_match_candidate_label.sql`.** I had offered three options: a display-name
column on `matches`, a `profiles` select policy gated on `sme_has_match_with()`,
or permanent "Candidate A/B/C" anonymity. Dev 1 took a fourth and better one: a
`SECURITY DEFINER` trigger derives `candidate_label` into `matches`, so `profiles`
never opens at all, and a second trigger takes the name back if a candidate later
opts out. The temporary `listCandidateLabelsForPosting` service-role read is
deleted — the ranked list now reads the derived column through the existing
`matches` policy, and shows no region, since match results are Match Score and
Gap Analysis only.

**2. Please confirm the service role is the intended path** for the remaining
elevated operations in the table above. `lib/supabase/admin.ts` already names
"the notification check", so this is likely just a yes. Note that `0005`'s column
grants make it mandatory for `upsertMatch`, whatever the answer.

**3. Two shared files were touched, both narrowly.** Flagging rather than
assuming:

- `app/layout.tsx` — `<html className="dark">`. The dark palette is the sandbox's
  design language and Dev 1's `.dark` tokens already exist, but the admin tables
  and skill radar were built light.
- `middleware.ts` — a no-op when `NEXT_PUBLIC_DATA_SOURCE` is exactly `mock`.
  Without it `updateSession` throws on the missing keys and mock mode cannot
  render a page, which costs us the offline demo fallback. Auth is untouched in
  every other case, including when the variable is unset. It originally skipped
  on anything that was not `supabase`, which meant the Vercel deployment — where
  the variable was never set — refreshed nobody's session and logged users out
  once their access token expired.

**4. ~~A latent font bug~~ — fixed by Dev 1 in `177e01a`.** `--font-sans` was
self-referential, so `font-sans` emitted nothing and Amharic fell back to tofu
boxes. Dev 1 fixed it at the root; the `body` stopgap in `app/globals.css` has
been removed.

**5. Please don't force-push `d1/foundation`.** Dev 3's branch is based on it
directly because it is not yet merged to `main`. Merging it to `main` is welcome.

No file under `supabase/` was created or edited. That boundary was not crossed.

---

## 8. Live Supabase verification — done

Everything below ran against the live project with real signed-in sessions, not
the service role, on migrations `0001`–`0005`. Three commands reproduce it:

| Command | Covers | Result |
| --- | --- | --- |
| `npm run check:contracts` | static drift between the migrations and Dev 3's code | 4 checks pass |
| `npm run verify:live` | RLS as real users, incl. the four QA probes | 24 checks pass |
| `npm run verify:flows` | grade, match, notify, handover through the real actions | 25 checks pass |

`verify:flows` needs `next dev` running with `NEXT_PUBLIC_DATA_SOURCE=supabase`.
Note that an exported `NEXT_PUBLIC_DATA_SOURCE` in the launching shell silently
beats `.env.local`; the script now refuses to run if it detects mock personas,
because otherwise every check passes for the wrong reason.

`npm run verify:mock` is the same idea for the offline fallback, and needs no
network or credentials at all — start the app with
`NEXT_PUBLIC_DATA_SOURCE=mock npm run dev` and run it. It exists because mock
mode reimplements in TypeScript what Postgres does in SQL: `0006`'s two label
triggers and the reviewed-brief filter both live twice now, and the copy that
runs on stage if the network dies is the one nothing was checking. It also
catches the case where the mock store and the live schema drift apart. Both
suites accept `VERIFY_BASE_URL` if the app is not on port 3000.

### What the live run caught

**A privilege violation, now fixed.** `0005` revokes table-wide `update` and
grants `authenticated` only `matches.status`. `upsertMatch()` wrote
`match_score` and `gap_analysis` through the caller's session, so re-running a
match was refused by the database — invisible in mock mode and invisible to
every static check, because RLS filters rows and grants filter columns. The
engine's own output now goes through the service role, with ownership enforced
by `requireOwnedPosting` in the action rather than by RLS. `setMatchStatus`
stays on the session client, since `status` is exactly what an SME is granted.
`check-contracts.py` now parses `0005` and cross-checks every adapter update
against the granted columns in both directions.

**The seeded data used the un-reconciled vocabulary.** Live
`sandbox_scores` and `role_skill_templates` were written with
`prompt_engineering`, `communication`, and `excel_basics` — section 1 of this
document is precisely about why that cannot work. `normalizeScores()` drops
unknown keys, so both seeded templates matched zero candidates, with no error
anywhere. [scripts/normalize-seed-vocabulary.sql](../scripts/normalize-seed-vocabulary.sql)
remaps them onto the frozen keys and is idempotent. `verify:live` now asserts
the two vocabularies still overlap, so this cannot regress quietly.

### Confirmed against real policies

- **All four QA probes** from [RLS_MODEL.md](RLS_MODEL.md) return nothing: a job
  seeker cannot read another's `skill_matrices` or `sandbox_scores`, an SME
  cannot read either for any candidate, `continuity_briefs` are invisible to the
  wrong SME and to every job seeker, and no SME sees another's notifications or
  payments. Anonymous reads of `profiles` and `sandbox_scores` are empty.
- **The service-role split is necessary, not defensive.** Each of the three
  elevated operations was confirmed to fail as a normal session: an SME reading
  candidate scores, an SME reading candidate profiles, and a user inserting a
  notification.
- **Column grants behave as intended.** A job seeker cannot PATCH themselves to
  `role = 'admin'`, and can still set their own `opt_in_discoverable`.
- **The full Pillar 3 loop works live**: grading writes a score under the
  candidate's own session, matching ranks real candidates and stores a gap
  analysis, re-running updates rather than duplicating, an SME cannot run a
  match on someone else's posting, shortlisting persists, and a reviewed brief
  becomes a scored challenge whose node id is written back.
- **The notification rules hold**: clearing a template notifies its owner
  unseen, re-grading does not duplicate, and a candidate who has not opted in is
  never evaluated.

### `pgvector` now runs, with a caveat worth stating plainly

Both `sme_postings.embedding` and `skill_matrices.embedding` are written on
every match run and verified live at 1536 dimensions.
[lib/matcher/embed.ts](../lib/matcher/embed.ts) is the provider seam: OpenAI
`text-embedding-3-small` when a key is present, and otherwise a deterministic
hashed bag-of-words at the same width, L2-normalised.

Matching the width offline is the point. The columns are `vector(1536)` and
Postgres rejects anything else, so without it the persistence path could not be
tested on a machine with no key — which is every machine we have.

**What this does not buy.** With both keys blank the vectors encode lexical
overlap, not meaning. Two candidates who describe the same competency in
different words still look unrelated. Semantic similarity is 10 of 100 Match
Score points and additive, so this changes ranking slightly and eligibility not
at all. Setting `OPENAI_API_KEY` and `AI_MODE=live` switches it with no other
change.

The candidate side no longer embeds bio and region, which described a person
rather than a verified capability. It is now built from the competencies they
scored strongly on plus the titles and sectors of challenges they completed, and
the role side names the competencies its template asks for, so both sides draw
wording from the same `COMPETENCIES` table.

### Still not exercised

- **In-database ANN.** Ranking loads vectors and compares them in the
  application. `order by embedding <=> $1` needs a SQL function, which is a
  migration, which is Dev 1's — see the request below.
- **The `0003` signup trigger**, beyond the accounts that already existed.

### For Dev 1

**1. The notification check disagrees with the match engine, and it costs the
Pillar 3 beat.** Measured live, not theorised.
`/api/notifications/check` scores a candidate on their *latest* value per
competency; `lib/matcher/run.ts` uses their *best*. Meron's seeded row holds
`ai_prompt_literacy` 82 and `customer_comms` 88, clearing Retail Inventory
Assistant. Grade her again and the stub returns 48 and 58, so under "latest" she
drops below a bar she had already cleared and no notification fires — while the
match engine still ranks her at 84 and lists her to the SME. The ranked list and
the notifications then contradict each other about the same person.

Best is the defensible rule: attempting a challenge again should never cost a
candidate standing they already earned, or the Sandbox punishes practice. There
is also a subtler problem with "latest" as implemented — a competency absent from
the newest row keeps its value from an older one, so the result is neither the
most recent attempt nor the best, but a mix.

The grade handler is wired to call your route behind `NOTIFY_VIA_DEV1_ROUTE=1`
and defaults to the stand-in so the demo beat keeps working. Flip the default the
moment the semantics agree; it is one condition in
[app/api/sandbox/grade/route.ts](../app/api/sandbox/grade/route.ts).

**2. `.env.example` tells Dev 3 to leave the service role blank, and that breaks
the matcher.** Your own `0005` does `revoke update on public.matches` then
`grant update (status)`, so an SME may set status and nothing else and
`upsertMatch` cannot write `match_score` or `gap_analysis` as the signed-in user.
Ranking is cross-user by nature too: an SME has no read on other candidates'
`sandbox_scores`, correctly. The grant is right and the split is right; only the
note is wrong. Corrected in the merge — worth knowing in case it is repeated
elsewhere.

**3. Dispatch Coordinator matches nobody, and the vocabulary fix did not touch
it.** It asks for `task_accuracy >= 80` and `customer_comms >= 70`. Dawit is
90/57, Meron 74/88, Hanna 68/93 and opted out. It is also the transition posting
behind the checklist's "Pillar 3b: Continuity Brief and custom challenge are
visible for the demo transition posting", so that beat currently shows an empty
ranked list beside a working handover challenge. Dropping `task_accuracy` to 70
would let Meron through.

**4. A request, not a change: the ANN function.** Ranking currently compares
vectors in the application, which is fine at seed scale and wrong at any real
one. The function below belongs in a migration, which is yours. With it, the
adapter switches to a single `.rpc("match_candidates_by_vector", ...)`.

```sql
create or replace function public.match_candidates_by_vector(
  query_embedding vector(1536),
  match_count int default 20
)
returns table (user_id uuid, similarity float)
language sql
stable
as $$
  select sm.user_id,
         1 - (sm.embedding <=> query_embedding) as similarity
  from public.skill_matrices sm
  join public.profiles p on p.id = sm.user_id
  where sm.embedding is not null
    and p.opt_in_discoverable          -- Section 9, enforced in the query
  order by sm.embedding <=> query_embedding
  limit match_count;
$$;
```

Two things to keep if you rewrite it: the `opt_in_discoverable` join, so the
opt-in gate cannot be forgotten by a caller, and returning `user_id` and a score
only, never matrix contents.

### Verifying without credentials

`npm run check:contracts`
([scripts/check-contracts.py](../scripts/check-contracts.py)). It reads the
migrations and fails on drift in three places that nothing else catches:

- **`lib/types/database.ts` against the migrations.** The mirror is
  hand-maintained, so a rename silently makes every downstream type wrong.
  Currently 11 tables and 77 columns, all matching. `alter table ... add column`
  from later migrations is folded in, since `0001` is not the whole schema —
  `0006` adds the two label columns that way.
- **`lib/data/supabase/adapter.ts` against the schema.** 40 queries across 10
  tables and 59 column references, all valid. Under RLS a wrong column name in a
  filter returns an empty array rather than an error, so this class of bug does
  not announce itself.
- **The four assumptions the service-role split rests on.** Each one asserts a
  policy does *not* exist. All four hold today: no SME select on
  `sandbox_scores`, no write policy on `continuity_briefs`, no insert policy on
  `notifications`, no SME select on `profiles`. If Dev 1 adds any of them, the
  script says which code path can be simplified rather than failing silently.
- **Column grants from `0005`.** Every adapter `update` is checked against the
  columns `authenticated` is actually granted, in both directions: a session
  write to a forbidden column, and a service-role write where the session client
  would have been tighter.

It also confirms RLS is enabled on all 10 tables Dev 3 touches, that the nine
request-scoped operations each have a matching policy, and that
`sme_has_match_with()` still checks `opt_in_discoverable` itself.

**One mock-only divergence to know about.** The mock adapter returns live
references into its in-memory store, so a caller that mutates a returned row
would corrupt the store. The Supabase adapter returns fresh objects every read.
No current code mutates a returned row, but a bug of that shape would be
invisible in mock mode and appear only against the live database.
