# Integration notes

Written by Dev 1 after trial-merging all three branches. Nothing here is merged
yet; this is what the merge will need when we do it.

## The merges are clean where it matters

Neither teammate branch conflicts with `d1/foundation` in application code. The
folder-ownership rules in `.cursor/rules/` did their job. Every conflict is in a
shared config file:

| Merge | Conflicting files |
| --- | --- |
| `d1/foundation` + `d2/ai-coach` | `package-lock.json` |
| `d1/foundation` + `dev3/pillar3-matcher` | `.env.example`, `.gitignore`, `package.json` |

`package.json` conflicts only because both sides added scripts. Take both:

```json
"typecheck": "tsc --noEmit",
"seed": "tsx --env-file=.env.local scripts/seed.ts",
"check:contracts": "python3 scripts/check-contracts.py",
"verify:mock": "python3 scripts/verify-mock-flows.py",
"verify:live": "python3 scripts/verify-live.py",
"verify:flows": "python3 scripts/verify-app-flows.py"
```

One caveat on `.env.example`, where "keep every line from both sides" is not
quite enough: the `d1/foundation` rewrite drops `NEXT_PUBLIC_DATA_SOURCE` and
`AI_MODE`, and unset counts as mock. A teammate following "copy this file and you
are set" therefore gets an app that looks live, is fully seeded, and is serving
in-memory fixtures. Both are restored on `dev3/pillar3-matcher`.

`package-lock.json` is not worth resolving by hand. Take either side, then run
`npm install` and commit the regenerated file.

`.env.example` and `.gitignore` are both additive; keep every line from both
sides. Nobody's entries contradict anybody else's.

## Dev 3: `check-contracts.py` needs to read every migration

> **Done** in `dev3/pillar3-matcher`. `parse_sql_tables()` now folds
> `alter table ... add column` from every migration into the schema it compares
> against, and drops what a later migration drops, per the suggestion below. The
> checker reports 77 columns and passes.

`npm run check:contracts` goes red on the merge, and not because of anything in
your code. It reads the schema from `0001_initial_schema.sql` alone, so any
column added by a later migration looks like `database.ts` drifting:

```
- types: matches.anonymous_label is in database.ts but not the migration
- types: matches.candidate_label is in database.ts but not the migration
```

Those two columns are real, applied, and live (`0006_match_candidate_label.sql`).
The assumption that the whole schema lives in `0001` breaks the first time Dev 1
ships a sixth migration, which has now happened, and it will break again on the
seventh. Two changes fix it for good.

Read all the migrations instead of the first:

```python
import glob

# Every migration, not just the first. Dev 1 adds columns in later files, and a
# checker that reads only 0001 reports each one as database.ts drifting.
SCHEMA_SQL = "\n".join(
    open(p).read() for p in sorted(glob.glob("supabase/migrations/*.sql"))
)
```

Then replay the alters, at the end of `parse_sql_tables()` just before its
`return tables`:

```python
    # Then replay what later migrations did to those tables.
    for m in re.finditer(
        r"alter table\s+(?:only\s+)?public\.(\w+)(.*?);", SCHEMA_SQL, re.S | re.I
    ):
        table, body = m.group(1), m.group(2)
        if table not in tables:
            continue
        for col in re.finditer(
            r"add column\s+(?:if not exists\s+)?([a-z_][a-z0-9_]*)([^,;]*)", body, re.I
        ):
            rest = col.group(2).lower()
            tables[table][col.group(1)] = {
                "nullable": "not null" not in rest,
                "default": "default" in rest,
            }
        for col in re.finditer(
            r"drop column\s+(?:if exists\s+)?([a-z_][a-z0-9_]*)", body, re.I
        ):
            tables[table].pop(col.group(1), None)
```

With both applied the checker reports 77 columns and passes. Verified on a
scratch merge of the two branches.

## Dev 3: the ranked-results screen can show real names

> **Done** in `dev3/pillar3-matcher`. The ranked list renders
> `match.candidate_label` directly, and the temporary
> `listCandidateLabelsForPosting` service-role read of `profiles` is deleted.
> Region went with it, since match results are Match Score and Gap Analysis only.
> The mock adapter mirrors both of `0006`'s triggers, including taking the name
> back on opt-out, so the offline fallback behaves the same.

`matches.candidate_label` now exists, so the anonymous `Candidate A / B / C`
labels no longer have to be the whole story. Render the column as-is:

```tsx
{match.candidate_label}
```

Do not join to `profiles` for a name -- an SME still cannot read a candidate's
profile row, and that is deliberate. A trigger fills the column in: the real name
while the candidate has `opt_in_discoverable` set, and the same
`Candidate A / B / C` you already built otherwise. So your anonymous UI is still
what an opted-out candidate gets, and nothing you built is wasted. The reasoning
is in `docs/RLS_MODEL.md`.

## Everyone: score keys are a fixed list

Six keys, in `lib/sandbox/competencies.ts`. Matching compares
`sandbox_scores.scores_json` against `role_skill_templates.thresholds_json` key
by key, and an unrecognised key is dropped rather than rejected -- so a stale key
means a template silently matches nobody, with an empty screen and nothing in the
logs. The live database and both seed files are now on the frozen list, and
`npm run verify:live` has three checks that will catch a stale one reappearing.

`skills_json` on the skill matrix is a separate, free-form thing. Nothing in
matching reads it.

## Everyone: what to say about payments in the pitch

Section 14 asks us to be explicit about what is real, so here is the honest
split, and it is a good story either way.

**Real:** the whole Telebirr C2B integration is written against Ethio Telecom's
own C2B Web Checkout guide, not a community package -- fabric token, signed
`preOrder`, the signed paygate redirect, `queryOrder` confirmation and the
`notify_url` webhook. The request signing is verified offline against the worked
example in their documentation (`npm run test:sign`). That is the file to open if
an Ethio Telecom representative asks to see the integration, which Section 14
says they will.

**Mocked, at the time of writing:** which rail actually runs on stage.
`PAYMENTS_PROVIDER` is on `mock`, because the private key issued by the portal
arrived truncated and no live call can be signed until it is reissued. The mock
is a Telebirr-styled checkout on our own origin, clearly labelled "Demo" on the
screen, and it writes the same `payments` row with `provider = 'mock'`.

Worth saying plainly rather than glossing: the integration is written and tested,
and it is one environment variable away from live. Do not claim money moved.

## Dev 3: two things premium touches

Both are one-liners on your side; the helpers are built and tested.

**Auto-notify is already gated, and you do not need to do anything.** A free SME
gets `notify_on_match` on one template, premium gets unlimited. It is enforced
inside `/api/notifications/check`, so the contract you call is unchanged and your
template editor can keep letting people tick the box. If you want to show the
limit in the UI, `canEnableNotify(smeId)` from `lib/payments/premium.ts` answers
"may they turn on one more".

**Priority handover is yours to place.** Section 6 sells it alongside auto-notify
and the payments side is ready, but the handover queue is on your branch, so I
have not reached into it. When you order continuity briefs, put premium companies
first:

```ts
import { premiumSmeIds } from "@/lib/payments/premium";

const premium = await premiumSmeIds(briefs.map((b) => b.sme_id));
briefs.sort((a, b) => Number(premium.has(b.sme_id)) - Number(premium.has(a.sme_id)));
```

`premiumSmeIds` is one query for the whole list rather than one per row. There is
also `isPremium(smeId)` for a single check.

## Dev 1: public `/handover` prefix + signing secret (Dev 2 Phase 6)

Outgoing employees may not have Skill-Connect accounts. The employee interview
lives at `/handover/[postingId]?token=...` and is gated by an expiring HMAC
token, not by Supabase Auth.

Dev 1 needs:

1. Add `"/handover"` to `PUBLIC_PREFIXES` in `lib/supabase/middleware.ts`.
2. Document `HANDOVER_SIGNING_SECRET` in `.env.example` (server-only, min 16
   characters). Dev 2 generates invite links with it.
3. Confirm continuity brief writes stay on the service-role server path already
   described in `docs/RLS_MODEL.md` (no client RLS write policy).

Applied on `d2/ai-coach` so Phase 6 is demoable; please review/own the
middleware and env-doc lines in the eventual merge.

## Dev 3: frozen `raw_interview_json` shape (Dev 2 Phase 6)

Source of truth: `lib/ai/handover.ts` (`rawInterviewJsonSchema`).

```json
{
  "version": 1,
  "locale": "en",
  "completed_at": "2026-07-26T00:00:00.000Z",
  "messages": [
    { "role": "assistant", "content": "..." },
    { "role": "user", "content": "..." }
  ]
}
```

Only consume rows where `reviewed_by_employee = true`. Never read unreviewed
briefs, and never expose `raw_interview_json` to SME UI.

## Everyone: the full three-way merge builds and passes

> Added by Dev 3, from a throwaway branch that merged `d2/ai-coach` onto
> `dev3/pillar3-matcher`, which already carries all seven commits of
> `d1/foundation`. Nothing was pushed and the branch was deleted afterwards, so
> the merge to `main` is still ours to do together.

The trial merges above establish which files conflict. This is the other half of
the question, and the one that decides whether `main` is demoable: does the
merged tree actually run. It does.

| Check | Result |
| --- | --- |
| `npm run typecheck` | clean |
| `npm run lint` | clean |
| `npm run check:contracts` | 11 tables, 77 columns, all contracts hold |
| `npm run build` | 23 routes compile |
| `npm run verify:mock` | 20 of 20 checks pass |

Two files conflict, both config, none of it application code -- the folder
ownership in `.cursor/rules/` did its job a second time. `package.json` is a
single line, Dev 3's `@xyflow/react`, which `d2/ai-coach` has no reason to carry;
keep it. Dev 2 independently picked the same versions Dev 3 did for `ai`,
`@ai-sdk/openai` and `zod`, so there is no version skew to reconcile. The
lockfile regenerates with `npm install`, as prescribed above.

## Dev 2: the coach throws when no LLM key is set

`lib/ai/engine.ts` refuses to start without a key:

```ts
if (!process.env.OPENAI_API_KEY) {
  throw new Error("OPENAI_API_KEY is not configured");
}
```

Neither `OPENAI_API_KEY` nor `GEMINI_API_KEY` is set in `.env.local` today, so on
the merged tree every Pillar 1 AI surface -- the chat, the skill matrix, the
career recommendations -- fails at runtime while the rest of the app is healthy.
This is not a merge problem; merging just puts it somewhere you can see it.

The asymmetry is worth naming, because it explains why the failure is one-sided.
Pillars 2 and 3 route model calls through `isLiveAI()` in `lib/ai/provider.ts`,
where `AI_MODE=live` only counts when a key is actually present:

```ts
return process.env.AI_MODE === "live" && Boolean(process.env.OPENAI_API_KEY);
```

Today `.env.local` sets `AI_MODE=stub` outright, so Pillars 2 and 3 are on the
deterministic path deliberately -- it needs no key and no network. The key check
above is the second layer: flipping `AI_MODE` to `live` on a machine without a key
still degrades to that same grader instead of breaking. Two independent reasons
the Sandbox demo survives a dead venue wifi, which is exactly the property Pillar 1
is missing.

There are two ways out and they are not exclusive. Someone adds a real key, which
works but leaves the demo dependent on the venue's network on the day. Or Pillar 1
gets a stub path chosen by the same predicate, so a missing key degrades to canned
output instead of an exception. The second is what actually makes the run safe,
and it is worth the hour.

## Dev 2: the schema gap closed while this was being written

> Resolved by Dev 2 in `a968b72`, minutes after the section below was drafted.
> Left in place because it records what to check, not because anything is
> outstanding.

`d2/ai-coach` used to branch from `df14fc1`, five commits behind
`d1/foundation`, so it had never seen `0005_column_grants.sql`,
`0006_match_candidate_label.sql`, the frozen-vocabulary seed fix, or
`scripts/seed.ts`. That merge has now happened, so Pillar 1 is building against
the current schema. The trial merge measured above predates it and should be
re-run against `5ffea41` before the real one.

One thing was already right, and is worth recording so nobody redoes it:
`lib/ai/sandbox-catalog.ts` mirrors Dev 3's registry exactly -- the same three
node ids, the same sectors, the same competency sets, on the frozen six keys. The
deep links in the career recommendations resolve to challenges that exist. That
was the Hour 14 handoff, and it landed.

## Dev 1: the deployment was serving Pillars 2 and 3 from fixtures

> Fixed on `dev3/pillar3-matcher`. The two defaults below are inverted, so this
> is already safe without anyone touching Vercel. The env var is still worth
> setting; it is now belt-and-braces rather than the only thing holding it up.

`README.md` lists four variables set on Production. `NEXT_PUBLIC_DATA_SOURCE` is
not one of them, and Dev 3's data seam read it as *"anything that is not
`supabase` means mock"*. So on `skill-connect-orcin.vercel.app`, every Sandbox
grade, match run and shortlist was hitting in-memory fixtures rather than the
seeded database -- and because that store is per-instance memory on a serverless
host, it was not even consistent between two requests. It looked healthy the
whole time, which is what made it worth catching before the demo and not during.

The same variable gated `middleware.ts`, which is the more serious half.
`updateSession` never ran in production, so an expired access token was never
refreshed and signed-in users were dropped roughly an hour in.

Neither suite caught it, and it is worth understanding why rather than adding
more checks blindly: `verify-routing.ps1` and `test-notifications.ps1` both reach
Supabase directly, server-side, so they pass identically whether or not anything
above the data seam is real. A green suite against production said nothing about
the seam, because the seam is not on their path.

Both defaults now require the literal string `mock` to opt out of the real
stack, so an unset variable fails loudly on missing Supabase keys instead of
quietly serving fiction. Setting it explicitly is still the right move:

```powershell
npx vercel env add NEXT_PUBLIC_DATA_SOURCE production   # value: supabase
npx vercel --prod
```

The redeploy is not optional. `NEXT_PUBLIC_*` variables are inlined at build
time, so adding one without rebuilding changes nothing.
