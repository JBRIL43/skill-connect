---
inclusion: always
---

# Skill-Connect Ethiopia — Shared Rules

Applies to every developer's AI session in this repo. Do not override these in a
personal prompt without team agreement.

## Project

AI-powered workforce platform for Ethiopian youth. Four pillars — (1) AI Talent
Discovery Coach, (2) "Walk-With-AI" Sandbox, (3) SME Talent Matcher + Company
Profiles, (3b) Institutional Handover Mode, (4) Admin Console. Full spec is in
`/docs/PROJECT_DOCS.md` — read the relevant section before generating any feature
you're unsure about instead of guessing.

## Tech stack — do not deviate or add alternatives

- Frontend: TypeScript, Next.js 15 (App Router), Tailwind, Shadcn UI, Framer Motion (polish only)
- Backend/DB: Supabase (Postgres + pgvector), Row Level Security on every sensitive table
- AI orchestration: Vercel AI SDK, streamed into React components
- LLM: OpenAI or Gemini API
- Visualization: `@xyflow/react` (sandbox node tree), Recharts or custom SVG (skill radar)
- Payments: Telebirr sandbox (primary), Chapa (backup narrative only)

## Hard boundaries — never do these without asking the user first

1. Never create or modify Supabase schema/migration files unless this session is
   explicitly Dev 1. If a schema change is needed, STOP and tell the user to route
   the request to Dev 1 — do not write the migration yourself.
2. Never edit code outside the folder(s) assigned to this session's developer. If
   something outside your scope looks broken, report it — don't fix it.
3. Never add a new npm package without asking the user to confirm first — every
   teammate has to install it too, and untracked deps break builds.
4. Never invent features beyond the documented build order (Section 10 of the docs).
   No "while I'm at it" additions or refactors. Simplest implementation that keeps
   the demo working wins, always.
5. Never use real people's names/photos or real company identities in seed or demo
   data — synthetic only, and never Ethio Telecom's name/brand in fictional data.
6. SMEs only ever see DERIVED candidate data (Sandbox Scores, badges, Gap Analysis
   text) — never raw conversation transcripts from intake or handover interviews.
   Enforce at the query/RLS layer, not just by hiding it in the UI.
7. Enforce opt-in discoverability: a candidate's scores only count toward an SME's
   Role Skill Template results if `profiles.opt_in_discoverable` is true. Filter
   server-side, never trust a client-side check.
8. Any "Workplace Pressure Simulation" prompt must stay critical of the WORK PRODUCT
   only, never of the person — no identity-linked discouragement — and must always
   expose a visible toggle back to supportive coaching mode.
9. Never commit secrets or `.env` files. Reference `process.env` vars only.
10. Continuity Briefs (Pillar 3b) are private to the issuing SME and require the
    outgoing employee's review/redaction before they're marked usable — never expose
    them pre-review.

## Always do these

- Follow the schema in Section 8 of the docs exactly — flat tables, no extra
  normalization under time pressure.
- Commit small and often. Don't let more than ~1 hour of work sit uncommitted.
- Branch as `<initials>/<feature>`, e.g. `d2/skill-radar`. Pull `origin/main` before
  merging back into it.
- If the same underlying AI logic is reused elsewhere in the spec (the Pillar 1
  conversational engine also powers the site-wide chatbot bubble and the Pillar 3b
  handover interview), build it as one reusable module, not three implementations.
- When uncertain about scope or a missing detail, choose the simplest option that
  keeps the demo working, state the assumption out loud, and keep moving.

## Folder ownership

| Path | Owner |
| --- | --- |
| `supabase/**`, `app/admin/**`, `app/api/payments/**`, auth + RLS | Dev 1 |
| `app/coach/**`, `app/chatbot/**`, handover interview | Dev 2 |
| `app/sandbox/**`, `app/matcher/**`, `app/company-profile/**` | Dev 3 |
