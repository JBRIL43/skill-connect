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
"verify:live": "python3 scripts/verify-live.py",
"verify:flows": "python3 scripts/verify-app-flows.py"
```

`package-lock.json` is not worth resolving by hand. Take either side, then run
`npm install` and commit the regenerated file.

`.env.example` and `.gitignore` are both additive; keep every line from both
sides. Nobody's entries contradict anybody else's.

## Dev 3: `check-contracts.py` needs to read every migration

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
