# **Cursor AI Team Coordination — Skill-Connect Ethiopia** 

This file has two parts: 

1. **The Shared Rules File** — commit this as `.cursorrules` at your repo root (or `.cursor/rules/project.mdc` if your team is on a newer Cursor version). Every teammate's AI reads this automatically from the repo — nobody has to paste it by hand. This is what keeps all three AIs "in harmony": same boundaries, same stack, same don't-touch list. 

2. **Three individual kickoff prompts** — one per developer. Each dev pastes their own into their first Cursor chat message of the session, on top of the shared rules, to lock in their scope for that sitting. 

Also: copy the full project doc into the repo as `/docs/PROJECT_DOCS.md` so any dev can `@` -reference it in Cursor when they need a section in full detail. 

## **PART 1 — Shared Rules File** 

#### **Save as** `.cursorrules` **in the repo root and commit it on the very first commit.** 

```
# Skill-Connect Ethiopia — Shared Cursor Rules
# Applies to every developer's AI session in this repo. Do not
override these
# in a personal prompt without team agreement.
```

```
## Project
Skill-Connect Ethiopia: AI-powered workforce platform for Ethiopian
youth.
Four pillars — (1) AI Talent Discovery Coach, (2) "Walk-With-AI"
Sandbox,
(3) SME Talent Matcher + Company Profiles, (3b) Institutional
Handover Mode,
(4) Admin Console. Full spec lives in /docs/PROJECT_DOCS.md — read it
before
generating any feature you're unsure about instead of guessing.
## Tech stack — do not deviate or add alternatives
Frontend: React, Next.js 15 (App Router), Tailwind, Shadcn UI, Framer
Motion (polish only)
Backend/DB: Supabase (Postgres + pgvector), Row Level Security on
every sensitive table
AI orchestration: Vercel AI SDK, streamed into React components
LLM: OpenAI or Gemini API
Visualization: @xyflow/react (sandbox node tree), Recharts or custom
SVG (skill radar)
Payments: Telebirr sandbox (primary), Chapa (backup narrative only)
## Hard boundaries — never do these without asking the user first
1. Never create or modify Supabase schema/migration files unless this
session
```

```
   is explicitly Dev 1. If a schema change is needed, STOP and tell
the user
   to route the request to Dev 1 — do not write the migration
yourself.
2. Never edit code outside the folder(s) assigned to this session's
developer
   (see their personal kickoff prompt). If something outside your
scope looks
   broken, report it — don't fix it.
3. Never add a new npm/pip package without asking the user to confirm
first —
   every teammate has to install it too, and untracked deps break
builds.
4. Never invent features beyond the documented build order (Section
10 of the
   docs). No "while I'm at it" additions or refactors. Simplest
implementation
   that keeps the demo working wins, always.
5. Never use real people's names/photos or real company identities in
seed or
   demo data — synthetic only, and never use Ethio Telecom's
name/brand in
   fictional demo data.
6. Enforce that SMEs only ever see DERIVED candidate data (Sandbox
Scores,
   badges, Gap Analysis text) — never raw conversation transcripts
from intake
   or handover interviews. Enforce this at the query/RLS layer, not
just by
   hiding it in the UI.
7. Enforce opt-in discoverability: a candidate's scores can only
count toward
   an SME's Role Skill Template results if that candidate has toggled
"open to
   being matched." Filter this server-side, never trust a client-side
check.
8. If building any "Workplace Pressure Simulation" prompt or logic:
the AI
   persona must stay critical of the WORK PRODUCT only, never of the
person —
   no identity-linked discouragement — and must always expose a
visible toggle
   back to supportive coaching mode.
9. Never commit secrets or .env files. Reference process.env vars
only, and
   confirm .env is in .gitignore before your first commit touches it.
10. Continuity Briefs (Pillar 3b) are private to the issuing SME and
must
    require the outgoing employee's review/redaction step before
they're
    marked usable — never expose them pre-review.
```

```
## Always do these
```

```
- Follow the schema in Section 8 of the docs exactly as given — flat
tables,
  no extra normalization under time pressure.
- Commit small and often. Don't let more than ~1 hour of work sit
uncommitted.
- Branch as <initials>/<feature>, e.g. d2/skill-radar. Pull
origin/main before
  merging back into it.
```

```
- If the same underlying AI logic is reused elsewhere in the spec
(e.g. the
  Pillar 1 conversational engine also powers the site-wide chatbot
bubble and
  the Pillar 3b handover interview), build it as one reusable module,
not
  three separate implementations.
- When uncertain about scope or a missing detail, choose the simplest
option
  that keeps the demo working, state the assumption out loud, and
keep moving.
```

## **PART 2 — Individual Kickoff Prompts** 

Each developer pastes **only their own** block as the first message of their Cursor session (after the shared rules file is already committed and present in the repo). 

### **Dev 1 — Platform, Trust & Payments Lead** 

```
I'm Dev 1 on this team. My scope for this session:
```

```
OWN (only I touch these):
- /supabase/migrations and all schema files — I am the ONLY person
who edits
  the schema. If Dev 2 or Dev 3 needs a schema change, they'll tell
me the
  requirement and I'll make the change myself.
- Auth + role routing (job_seeker / sme / admin)
- RLS policies (this is our strongest technical talking point for
judges —
  be thorough, not fast, here)
- Notifications backend (template-triggered logic)
- Admin console (/app/admin) — live counters, seed-data button, SME
  verification toggle
- Payment flow (/app/api/payments) — Telebirr sandbox integration, or
a
  Telebirr-styled mock if sandbox credentials haven't arrived yet
```

```
DO NOT TOUCH without asking me first:
- /app/coach, /app/chatbot (Dev 2's scope)
- /app/sandbox, /app/matcher, /app/company-profile (Dev 3's scope)
```

```
Confirm you've loaded the shared .cursorrules file context, then
let's start
with: [insert current task, e.g. "scaffold the Supabase schema from
Section 8
of the docs"].
```

### **Dev 2 — AI Coach Lead** 

```
I'm Dev 2 on this team. My scope for this session:
```

```
OWN (only I touch these):
- /app/coach — Pillar 1 intake chat (Amharic/English, streaming via
Vercel
  AI SDK), skill JSON extraction, Skill Radar visualization
```

```
- Career recommendation logic (links matrix output to specific
Sandbox nodes)
- /app/chatbot — site-wide "Ask Skill-Connect" bubble (reuses the
Pillar 1
  engine — do not build this as a separate system)
- Pillar 3b's AI Handover Interview (also reuses the Pillar 1 engine,
fed
  with different prompt content — employee's day-to-day instead of a
  general intake)
```

```
DO NOT TOUCH without asking:
- /supabase/migrations or any schema file — if I need a new field or
table,
  I'll tell Dev 1 the requirement, not write the migration myself
- /app/admin, /app/api/payments (Dev 1's scope)
- /app/sandbox, /app/matcher (Dev 3's scope)
```

```
Confirm you've loaded the shared .cursorrules file context, then
let's start
with: [insert current task, e.g. "build the intake conversation flow
that
outputs structured skill JSON"].
```

### **Dev 3 — Sandbox & SME Matcher Lead** 

```
I'm Dev 3 on this team. My scope for this session:
```

```
OWN (only I touch these):
- /app/sandbox — Pillar 2 node-tree UI (@xyflow/react), AI-graded
challenge
  submission, sandbox_scores + badge writes
- /app/company-profile — Company Profile pages
- /app/matcher — Role Skill Template builder, pgvector semantic match
query,
  Match Score + Gap Analysis output, shortlist/hire action,
notifications UI
- Pillar 3b's custom sandbox challenge generation (reuses my Pillar 2
  grading logic, fed with the outgoing employee's described tasks
instead
  of a generic template)
DO NOT TOUCH without asking:
- /supabase/migrations or any schema file — if I need a new field or
table,
  I'll tell Dev 1 the requirement, not write the migration myself
- /app/admin, /app/api/payments (Dev 1's scope)
- /app/coach, /app/chatbot (Dev 2's scope)
```

```
Confirm you've loaded the shared .cursorrules file context, then
let's start
with: [insert current task, e.g. "wire one full sandbox challenge
end-to-end:
submit response, AI grades it, score writes to sandbox_scores, badge
awards"].
```

## **Optional upgrade (if your team is on a newer Cursor version)** 

Instead of one flat `.cursorrules` , Cursor supports **scoped rule files** under `.cursor/rules/*.mdc` , each with a `globs` field that auto-activates only when a file in that path is opened. You could split the shared rules file above into: 

- `global.mdc` — always applied (the "hard boundaries" and stack section) 

- `schema-owner-only.mdc` — `globs: supabase/**` — warns any AI opening those files that they belong to Dev 1 only 

- `admin-owner-only.mdc` — `globs: app/admin/**` — same idea for Dev 1's admin scope 

This is a nice-to-have, not necessary for 48 hours — the single flat file above is enough to keep three AIs from stepping on each other. 

