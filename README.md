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

## Database

The Supabase project is already provisioned and all migrations are applied. You
only need the URL and anon key in your `.env.local` to start building — ask
Dev 1 on the secrets channel.

Migrations live in `supabase/migrations` and run in filename order:

| File | What it does |
| --- | --- |
| `0001_initial_schema.sql` | Extensions, enums, all 11 tables, RLS enabled with no policies (deny-all) |
| `0002_rls_policies.sql` | The access rules from Section 9 of the spec |
| `0003_auth_signup_trigger.sql` | Creates the profile row (and an SME's company profile) on signup |
| `0004_auto_enable_rls_trigger.sql` | Event trigger forcing RLS on any future `public` table |
| `0005_column_grants.sql` | Column-level grants, so a user cannot edit their own `role` |

Dev 1 applies new migrations with `npx supabase db push`. Nobody else should
create files in this folder.

### Test accounts

Password for all three is `Test1234!`.

| Email | Role | Lands on |
| --- | --- | --- |
| `selam.seeker@example.com` | job_seeker | `/dashboard` |
| `abeba.sme@example.com` | sme | `/dashboard` (SME view) |
| `sneaky.admin@example.com` | admin | `/admin` |

Email confirmation is turned off on this project, so new signups work
immediately without waiting on an inbox.

### Creating another admin

Admin is never self-serve. Either flip a user's `role` to `admin` in Supabase
Studio → Table Editor → `profiles`, or sign in as any account and visit
`/admin/promote` with the `ADMIN_INVITE_CODE` from `.env.local`.

## Scripts

```powershell
.\scripts\test-rls.ps1                      # the security test suite — run after any migration
.\scripts\run-sql.ps1 -Query "select 1;"    # ad-hoc SQL against the linked project
```

`test-rls.ps1` checks that candidates see their own data, that nobody else can,
that public surfaces still work, and that a job seeker cannot promote themselves
to admin. Any FAIL is a P0 and stops the build.

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
