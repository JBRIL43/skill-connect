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

## Authentication

Email and password only. Section 4 describes signing up with "email or phone",
but real phone auth needs a paid SMS provider with uncertain Ethiopian
deliverability, so phone is captured as an optional **profile field** instead —
the signup form collects it, `09XX`/`+251` variants are normalized to one
canonical `+251XXXXXXXXX`, and the signup trigger writes it to `profiles.phone`.
Describe it as "email sign-in, phone on the profile" in the pitch rather than
implying SMS login.

Email confirmation is turned off on this project, so new signups work
immediately without waiting on an inbox.

Role routing is asserted by `.\scripts\verify-routing.ps1`: each role has one
landing page and cannot reach another's.

### Test accounts

Password for all three is `Test1234!`.

| Email | Role | Lands on |
| --- | --- | --- |
| `selam.seeker@example.com` | job_seeker | `/dashboard` |
| `abeba.sme@example.com` | sme | `/dashboard` (SME view) |
| `sneaky.admin@example.com` | admin | `/admin` |

### Creating another admin

Admin is never self-serve. Either flip a user's `role` to `admin` in Supabase
Studio → Table Editor → `profiles`, or sign in as any account and visit
`/admin/promote` with the `ADMIN_INVITE_CODE` from `.env.local`.

## Scripts

```powershell
.\scripts\test-rls.ps1                      # the security test suite — run after any migration
.\scripts\verify-routing.ps1                # role routing — needs `npm run dev` in another terminal
.\scripts\test-notifications.ps1            # the notification check — also needs a dev server
.\scripts\run-sql.ps1 -Query "select 1;"    # ad-hoc SQL against the linked project
```

`test-rls.ps1` checks that candidates see their own data, that nobody else can,
that an unreviewed handover brief is invisible even to the company that
commissioned it, that one company cannot see another's notifications or
payments, and that a job seeker cannot promote themselves to admin.

`test-notifications.ps1` covers the contract Dev 3 calls into: an opted-out
candidate is never surfaced, a cleared template files exactly one notification,
a second call files none, and a candidate cannot run the check for anyone else.

`verify-routing.ps1` signs in as each test account and asserts where the server
actually sends them: signed-out users bounce to `/login`, a job seeker and an
SME get different dashboards, and only an admin reaches `/admin`. If Next tells
you port 3000 was taken, pass the port it used:
`.\scripts\verify-routing.ps1 -BaseUrl http://localhost:3001`.

Any FAIL in either suite is a P0 and stops the build.

## Demo seed data

`supabase/seed/seed-job-seekers.json` and `seed-smes.json` hold the personas the
demo runs on. The admin console has a **Seed demo data** button that loads them;
it is the fallback if a live signup or a grading call fails on stage, so it is
safe to press repeatedly — every row is keyed off the persona's `key`, and a
second press updates the same rows instead of creating duplicates.

The sample committed here is synthetic. Replacing it with real personas means
editing the JSON only — no code changes, and no need to understand the schema.

A job seeker looks like this. `key` is a permanent nickname for the persona:
change any other field freely, but changing `key` creates a second person.

```json
{
  "key": "meron-tadesse",
  "full_name": "Meron Tadesse",
  "email": "meron.tadesse@seed.skillconnect.et",
  "phone": "+251911234501",
  "region": "Addis Ababa",
  "bio": "One or two sentences in their own voice.",
  "opt_in_discoverable": true,
  "readiness_score": 74,
  "skills": { "technical": { "excel_basics": 71 }, "human": { "customer_comms": 82 } },
  "sandbox_scores": [
    {
      "node_id": "merkato-whatsapp-catalog",
      "mode": "standard",
      "scores": { "prompt_engineering": 82, "task_accuracy": 74, "communication": 88 }
    }
  ],
  "badges": [{ "node_id": "merkato-whatsapp-catalog", "badge_name": "Catalog Builder" }]
}
```

A company looks like this:

```json
{
  "key": "abeba-retail",
  "company_name": "Abeba Retail",
  "contact_name": "Abeba Mekonnen",
  "email": "abeba.retail@seed.skillconnect.et",
  "industry": "Retail",
  "size": "11-50",
  "about": "What the business does, in plain language.",
  "verified": true,
  "templates": [
    {
      "key": "inventory-assistant",
      "role_name": "Retail Inventory Assistant",
      "notify_on_match": true,
      "thresholds": { "excel_basics": 70, "prompt_engineering": 75 }
    }
  ],
  "postings": [
    {
      "key": "inventory-assistant-q3",
      "template_key": "inventory-assistant",
      "description": "What the person would actually do all day.",
      "is_transition_role": false
    }
  ]
}
```

Three rules make the demo tell a story rather than show noise:

1. **Every score is 0-100.** A competency name is a lowercase slug like
   `excel_basics`, and the *same slug* must appear in a candidate's `scores` and
   in a company's `thresholds`, or the two never meet.
2. **At least one candidate should clear a template and one should miss it.**
   The notification demo needs both, and a near miss is the more interesting
   story on stage.
3. **At least one candidate should have `opt_in_discoverable: false`,** to show
   that a candidate who has not opted in stays invisible to companies.

Every seeded account signs in with the password in `SEED_PASSWORD`
(`lib/seed/contract.ts`), currently `Test1234!`, so you can log in as any
persona during the pitch.

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

## UI conventions

Three people are building three pillars at once. These four rules are what stop
the demo from looking like three separate apps stitched together.

**Wrap every signed-in page in `AppShell`.** It supplies the header, the
max-width and the page padding, so `/coach`, `/sandbox` and `/admin` all frame
identically. Put the title in `PageHeader` rather than a bare `<h1>`.

```tsx
<AppShell profile={profile}>
  <PageHeader title="Sandbox" description="Solve a real Ethiopian business challenge." />
  {/* page content */}
</AppShell>
```

**Never hard-code a colour.** No `text-green-600`, no hex values. Use the theme
tokens — `bg-background`, `text-muted-foreground`, `bg-primary`, `bg-card`,
`text-destructive` — so dark mode and any late palette change apply everywhere
at once. Chart and radar series come from `--chart-1` through `--chart-5`, which
are five distinct hues chosen so the Skill Radar stays readable.

**Any number out of 100 renders as `<ScoreBadge />`.** Sandbox Scores, Match
Scores, the coach's initial read and the admin table all show the same thing, so
they should look the same. Pass `threshold` when the score is being judged
against a Role Skill Template bar and the badge switches to cleared/not-cleared.

```tsx
<ScoreBadge score={82} label="Prompt engineering" />
<ScoreBadge score={68} threshold={70} />
```

**No screen should ever look broken.** Use `EmptyState` when there is no data
and the skeletons in `components/skeletons.tsx` (`PageHeaderSkeleton`,
`CardGridSkeleton`, `TableSkeleton`) while something loads. An unstyled empty
table on stage reads as a bug.

Shared files — `app/globals.css`, `components/app-shell.tsx`,
`components/app-header.tsx`, `components/ui/**` — belong to everyone, so a
change there breaks all three pillars at once. Say so in the team channel before
editing one.

## Security rules that are not negotiable

See [`docs/RLS_MODEL.md`](docs/RLS_MODEL.md) for the full plain-English policy
summary. The short version:

- Companies never read a candidate's raw intake or handover transcript. They see
  derived output only: match score, gap analysis, and badges.
- A candidate's scores only count toward a company's search once that candidate
  sets `opt_in_discoverable`. Filtered server-side, never in the client.
- A continuity brief is invisible to everyone until the outgoing employee has
  reviewed and redacted it.
