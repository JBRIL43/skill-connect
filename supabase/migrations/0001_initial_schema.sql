-- Skill-Connect Ethiopia — initial schema
-- Source of truth: docs/PROJECT_DOCS.md Section 8.
-- Tables stay flat and denormalized on purpose. Do not add join tables.
--
-- RLS is enabled on every table here but no policies are defined yet. A table
-- with RLS on and zero policies denies all access, which is the safe state to
-- sit in while 0002_rls_policies.sql is being written.

create extension if not exists vector;
create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

create type public.user_role as enum ('job_seeker', 'sme', 'admin');
create type public.sandbox_mode as enum ('standard', 'pressure_simulation');
create type public.posting_status as enum ('open', 'filled');
create type public.match_status as enum ('suggested', 'shortlisted', 'hired');
create type public.payment_provider as enum ('telebirr', 'chapa', 'mock');
create type public.payment_status as enum ('pending', 'paid');

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
-- opt_in_discoverable is not in Section 8's table list but Section 9's trust
-- model requires it: a candidate's scores may only count toward an SME's Role
-- Skill Template results once they have opted in. Filtered server-side.
--
-- is_seed tags rows created by the admin console's "seed demo data" button so
-- the button stays idempotent and seeded data can be identified during a demo.

create table public.profiles (
  id                   uuid primary key references auth.users(id) on delete cascade,
  role                 public.user_role not null,
  full_name            text,
  bio                  text,
  phone                text,
  region               text,
  opt_in_discoverable  boolean not null default false,
  is_seed              boolean not null default false,
  created_at           timestamptz not null default now()
);

create index profiles_role_idx on public.profiles (role);
create index profiles_discoverable_idx on public.profiles (opt_in_discoverable) where opt_in_discoverable;

-- ---------------------------------------------------------------------------
-- company_profiles (one per SME)
-- ---------------------------------------------------------------------------
-- verified = false is the "pending_verification" state from Section 4. There is
-- deliberately no separate status column.

create table public.company_profiles (
  id            uuid primary key default gen_random_uuid(),
  sme_id        uuid not null unique references public.profiles(id) on delete cascade,
  company_name  text not null,
  industry      text,
  size          text,
  logo_url      text,
  about         text,
  verified      boolean not null default false,
  created_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- skill_matrices
-- ---------------------------------------------------------------------------
-- Written by Dev 2's intake coach. This is the coach's own initial read, NOT a
-- verified Sandbox Score. SMEs must never be able to read this table.
--
-- embedding backs Dev 3's pgvector semantic match. Sized for OpenAI
-- text-embedding-3-small (1536). If the team picks Gemini instead, tell Dev 1 —
-- the dimension has to change here and on sme_postings in a new migration.

create table public.skill_matrices (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references public.profiles(id) on delete cascade,
  skills_json      jsonb not null default '{}'::jsonb,
  readiness_score  integer,
  embedding        vector(1536),
  created_at       timestamptz not null default now()
);

create index skill_matrices_user_idx on public.skill_matrices (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- sandbox_scores (one row per completed challenge)
-- ---------------------------------------------------------------------------

create table public.sandbox_scores (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles(id) on delete cascade,
  node_id       text not null,
  scores_json   jsonb not null default '{}'::jsonb,
  mode          public.sandbox_mode not null default 'standard',
  completed_at  timestamptz not null default now()
);

create index sandbox_scores_user_idx on public.sandbox_scores (user_id, completed_at desc);
create index sandbox_scores_node_idx on public.sandbox_scores (node_id);

-- ---------------------------------------------------------------------------
-- badges
-- ---------------------------------------------------------------------------

create table public.badges (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  node_id     text not null,
  badge_name  text not null,
  awarded_at  timestamptz not null default now(),
  unique (user_id, node_id)
);

-- ---------------------------------------------------------------------------
-- role_skill_templates (reusable SME scoring checklists)
-- ---------------------------------------------------------------------------

create table public.role_skill_templates (
  id               uuid primary key default gen_random_uuid(),
  sme_id           uuid not null references public.profiles(id) on delete cascade,
  role_name        text not null,
  thresholds_json  jsonb not null default '{}'::jsonb,
  notify_on_match  boolean not null default true,
  created_at       timestamptz not null default now()
);

create index role_skill_templates_sme_idx on public.role_skill_templates (sme_id);

-- ---------------------------------------------------------------------------
-- sme_postings
-- ---------------------------------------------------------------------------

create table public.sme_postings (
  id                  uuid primary key default gen_random_uuid(),
  sme_id              uuid not null references public.profiles(id) on delete cascade,
  template_id         uuid references public.role_skill_templates(id) on delete set null,
  description         text,
  embedding           vector(1536),
  is_transition_role  boolean not null default false,
  status              public.posting_status not null default 'open',
  created_at          timestamptz not null default now()
);

create index sme_postings_sme_idx on public.sme_postings (sme_id);
create index sme_postings_status_idx on public.sme_postings (status);

-- ---------------------------------------------------------------------------
-- continuity_briefs (transition roles only)
-- ---------------------------------------------------------------------------
-- reviewed_by_employee is load-bearing, not cosmetic: RLS refuses to return a
-- brief until the outgoing employee has reviewed and redacted it.

create table public.continuity_briefs (
  id                    uuid primary key default gen_random_uuid(),
  posting_id            uuid not null references public.sme_postings(id) on delete cascade,
  raw_interview_json    jsonb,
  generated_brief       text,
  custom_node_id        text,
  reviewed_by_employee  boolean not null default false,
  created_at            timestamptz not null default now()
);

create index continuity_briefs_posting_idx on public.continuity_briefs (posting_id);

-- ---------------------------------------------------------------------------
-- matches
-- ---------------------------------------------------------------------------
-- The only table through which an SME sees anything about a candidate, and only
-- the derived columns: match_score, gap_analysis, status.

create table public.matches (
  id            uuid primary key default gen_random_uuid(),
  posting_id    uuid not null references public.sme_postings(id) on delete cascade,
  candidate_id  uuid not null references public.profiles(id) on delete cascade,
  match_score   integer,
  gap_analysis  text,
  status        public.match_status not null default 'suggested',
  created_at    timestamptz not null default now(),
  unique (posting_id, candidate_id)
);

create index matches_posting_idx on public.matches (posting_id);
create index matches_candidate_idx on public.matches (candidate_id);

-- ---------------------------------------------------------------------------
-- notifications (template-triggered, never a general feed)
-- ---------------------------------------------------------------------------
-- The unique constraint is what guarantees the notification check can run after
-- every graded challenge without ever producing a duplicate.

create table public.notifications (
  id            uuid primary key default gen_random_uuid(),
  sme_id        uuid not null references public.profiles(id) on delete cascade,
  template_id   uuid not null references public.role_skill_templates(id) on delete cascade,
  candidate_id  uuid not null references public.profiles(id) on delete cascade,
  seen          boolean not null default false,
  created_at    timestamptz not null default now(),
  unique (sme_id, template_id, candidate_id)
);

create index notifications_sme_idx on public.notifications (sme_id, seen, created_at desc);

-- ---------------------------------------------------------------------------
-- payments
-- ---------------------------------------------------------------------------

create table public.payments (
  id          uuid primary key default gen_random_uuid(),
  sme_id      uuid not null references public.profiles(id) on delete cascade,
  provider    public.payment_provider not null,
  amount      integer not null,
  status      public.payment_status not null default 'pending',
  created_at  timestamptz not null default now()
);

create index payments_sme_idx on public.payments (sme_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Enable RLS everywhere. Policies land in 0002_rls_policies.sql.
-- ---------------------------------------------------------------------------

alter table public.profiles             enable row level security;
alter table public.company_profiles     enable row level security;
alter table public.skill_matrices       enable row level security;
alter table public.sandbox_scores       enable row level security;
alter table public.badges               enable row level security;
alter table public.role_skill_templates enable row level security;
alter table public.sme_postings         enable row level security;
alter table public.continuity_briefs    enable row level security;
alter table public.matches              enable row level security;
alter table public.notifications        enable row level security;
alter table public.payments             enable row level security;
