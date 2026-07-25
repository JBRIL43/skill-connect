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
  Switch to `supabase` when Dev 1's schema is live; only the adapter changes.
- `AI_MODE=stub` — deterministic local grading and generation, no API key needed.
  Switch to `live` for the Vercel AI SDK path once `OPENAI_API_KEY` is set.

`AI_MODE=stub` is also the on-stage fallback: if the LLM is rate-limited during
judging, challenges still grade, badges still pop, and matching still ranks.

Never import Supabase or an LLM provider directly in a component or route —
go through `lib/data` and `lib/ai` so both switches keep working.

---

## 6. Temporary files Dev 1 will replace

Dev 3 scaffolded the app because Dev 1's foundation did not exist yet. These are
placeholders, not territory:

- `app/layout.tsx`, `app/page.tsx`, `components/app-nav.tsx` — replace with the
  real shell and dashboard routing.
- `lib/session.ts` — cookie-based demo identity switcher standing in for Supabase
  Auth. Replace `getCurrentUser()` with the real session lookup and every Dev 3
  surface keeps working.
- No file under `supabase/` was created. That boundary was not crossed.
