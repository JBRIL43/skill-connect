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
