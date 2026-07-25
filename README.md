# Skill-Connect Ethiopia

AI-powered workforce infrastructure connecting Ethiopian youth with SMEs through
verified, AI-graded capability scores rather than self-reported resume claims.

Built for the Cursor AI Hackathon Ethiopia. Full spec in
[`docs/PROJECT_DOCS.md`](docs/PROJECT_DOCS.md), per-developer task lists in
[`docs/TASK_BREAKDOWN.md`](docs/TASK_BREAKDOWN.md).

## Getting started

```bash
npm install
cp .env.example .env.local   # then fill in the values from the team secrets channel
npm run dev
```

The app runs at http://localhost:3000.

`.env.local` is gitignored. Never commit real credentials — `.env.example` is
the only env file that belongs in git.

## Database setup

Migrations live in `supabase/migrations` and run in filename order. Apply them
by pasting each file into the Supabase Studio SQL editor, oldest first:

| File | What it does |
| --- | --- |
| `0001_initial_schema.sql` | Extensions, enums, all 11 tables, RLS enabled with no policies (deny-all) |
| `0002_rls_policies.sql` | The access rules from Section 9 of the spec |
| `0003_auth_signup_trigger.sql` | Creates the profile row (and an SME's company profile) on signup |

Two settings to check in the Supabase dashboard afterwards:

- **Authentication → Providers → Email**: turn *Confirm email* off, so the demo
  never waits on an inbox.
- **Database → Extensions**: confirm `vector` is enabled. `0001` enables it, but
  it is worth eyeballing since the match engine depends on it.

### Creating the first admin

Admin is never self-serve. Either flip a seed user's `role` to `admin` in
Supabase Studio → Table Editor → `profiles`, or sign in as any account and visit
`/admin/promote` with the `ADMIN_INVITE_CODE` from `.env.local`.

## Folder ownership

Three developers work in parallel. Stay inside your own folders; if you need
something outside them, ask its owner rather than editing it.

| Path | Owner |
| --- | --- |
| `supabase/**`, `app/admin/**`, `app/api/payments/**`, `app/auth/**`, `lib/supabase/**`, `middleware.ts` | Dev 1 |
| `app/coach/**`, `app/chatbot/**` | Dev 2 |
| `app/sandbox/**`, `app/matcher/**`, `app/company-profile/**` | Dev 3 |

Schema changes are Dev 1's alone. Describe what you need in plain language and
Dev 1 writes the migration — this is what keeps migration merge conflicts from
appearing at hour 30.

## Shared building blocks

- `lib/supabase/server.ts` — request-scoped client that runs under the user's
  RLS policies. Use this by default.
- `lib/supabase/client.ts` — browser client.
- `lib/supabase/admin.ts` — service-role client that bypasses RLS. Server-side
  only, for the admin console, the notification check, and payments.
- `lib/auth.ts` — `getSessionProfile`, `requireProfile`, `requireRole`.
- `lib/types/database.ts` — row types mirroring the migrations.

## Security rules that are not negotiable

See [`docs/RLS_MODEL.md`](docs/RLS_MODEL.md) for the full plain-English policy
summary. The short version:

- Companies never read a candidate's raw intake or handover transcript. They see
  derived output only: match score, gap analysis, and badges.
- A candidate's scores only count toward a company's search once that candidate
  sets `opt_in_discoverable`. Filtered server-side, never in the client.
- A continuity brief is invisible to everyone until the outgoing employee has
  reviewed and redacted it.
