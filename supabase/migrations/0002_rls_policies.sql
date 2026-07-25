-- Skill-Connect Ethiopia — Row Level Security policies
-- Source of truth: docs/PROJECT_DOCS.md Section 9 (Trust & Security Model).
--
-- The one rule everything below serves: an SME never reads a candidate's raw
-- intake or handover content. They read DERIVED output only — match_score,
-- gap_analysis, and badges — and only for candidates who opted in.

-- ---------------------------------------------------------------------------
-- Helper functions
-- ---------------------------------------------------------------------------
-- These are SECURITY DEFINER because a policy on profiles that itself queries
-- profiles would recurse infinitely. search_path is pinned on each one so a
-- caller cannot shadow public with their own schema.

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

create or replace function public.owns_posting(p_posting_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.sme_postings
    where id = p_posting_id and sme_id = auth.uid()
  );
$$;

-- True when the calling SME has a match row for this candidate on one of their
-- own postings. Gates the only cross-user read an SME is ever granted.
create or replace function public.sme_has_match_with(p_candidate_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.matches m
    join public.sme_postings p on p.id = m.posting_id
    join public.profiles c on c.id = m.candidate_id
    where p.sme_id = auth.uid()
      and m.candidate_id = p_candidate_id
      and c.opt_in_discoverable
  );
$$;

revoke execute on function public.is_admin() from public;
revoke execute on function public.owns_posting(uuid) from public;
revoke execute on function public.sme_has_match_with(uuid) from public;

grant execute on function public.is_admin() to authenticated;
grant execute on function public.owns_posting(uuid) to authenticated;
grant execute on function public.sme_has_match_with(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------

create policy "profiles: read own"
  on public.profiles for select
  using (id = auth.uid());

create policy "profiles: admin reads all"
  on public.profiles for select
  using (public.is_admin());

create policy "profiles: update own"
  on public.profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());

-- Backstop for the handle_new_user trigger in 0003. A user may only ever create
-- their own row, and may never self-assign the admin role.
create policy "profiles: insert own non-admin row"
  on public.profiles for insert
  with check (id = auth.uid() and role <> 'admin');

-- ---------------------------------------------------------------------------
-- company_profiles
-- ---------------------------------------------------------------------------
-- Company profiles are public by design (Section 3, Pillar 3) — they are a
-- marketing surface and carry no candidate data.

create policy "company_profiles: public read"
  on public.company_profiles for select
  using (true);

create policy "company_profiles: sme writes own"
  on public.company_profiles for insert
  with check (sme_id = auth.uid());

create policy "company_profiles: sme updates own"
  on public.company_profiles for update
  using (sme_id = auth.uid())
  with check (sme_id = auth.uid());

-- verified is flipped by the admin console only, never by the SME themselves.
create policy "company_profiles: admin updates any"
  on public.company_profiles for update
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- skill_matrices — owner and admin only, no exceptions
-- ---------------------------------------------------------------------------
-- An SME must never read this table, not even for a candidate who matched to
-- them. This is Section 9's core rule and the thing QA actively tries to break.

create policy "skill_matrices: read own"
  on public.skill_matrices for select
  using (user_id = auth.uid());

create policy "skill_matrices: admin reads all"
  on public.skill_matrices for select
  using (public.is_admin());

create policy "skill_matrices: insert own"
  on public.skill_matrices for insert
  with check (user_id = auth.uid());

create policy "skill_matrices: update own"
  on public.skill_matrices for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- sandbox_scores — same visibility rule as skill_matrices
-- ---------------------------------------------------------------------------

create policy "sandbox_scores: read own"
  on public.sandbox_scores for select
  using (user_id = auth.uid());

create policy "sandbox_scores: admin reads all"
  on public.sandbox_scores for select
  using (public.is_admin());

create policy "sandbox_scores: insert own"
  on public.sandbox_scores for insert
  with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- badges
-- ---------------------------------------------------------------------------
-- Section 9 names badges as SME-visible derived output, so SMEs get a read —
-- but narrowly: only for a candidate who both opted in AND already matched to
-- one of that SME's own postings.

create policy "badges: read own"
  on public.badges for select
  using (user_id = auth.uid());

create policy "badges: admin reads all"
  on public.badges for select
  using (public.is_admin());

create policy "badges: sme reads matched candidates"
  on public.badges for select
  using (public.sme_has_match_with(user_id));

create policy "badges: insert own"
  on public.badges for insert
  with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- role_skill_templates — an SME sees only their own checklists
-- ---------------------------------------------------------------------------

create policy "role_skill_templates: sme reads own"
  on public.role_skill_templates for select
  using (sme_id = auth.uid());

create policy "role_skill_templates: admin reads all"
  on public.role_skill_templates for select
  using (public.is_admin());

create policy "role_skill_templates: sme inserts own"
  on public.role_skill_templates for insert
  with check (sme_id = auth.uid());

create policy "role_skill_templates: sme updates own"
  on public.role_skill_templates for update
  using (sme_id = auth.uid())
  with check (sme_id = auth.uid());

create policy "role_skill_templates: sme deletes own"
  on public.role_skill_templates for delete
  using (sme_id = auth.uid());

-- ---------------------------------------------------------------------------
-- sme_postings — open postings are browsable, CRUD is owner-only
-- ---------------------------------------------------------------------------

create policy "sme_postings: authenticated read open"
  on public.sme_postings for select
  to authenticated
  using (status = 'open');

create policy "sme_postings: sme reads own"
  on public.sme_postings for select
  using (sme_id = auth.uid());

create policy "sme_postings: admin reads all"
  on public.sme_postings for select
  using (public.is_admin());

create policy "sme_postings: sme inserts own"
  on public.sme_postings for insert
  with check (sme_id = auth.uid());

create policy "sme_postings: sme updates own"
  on public.sme_postings for update
  using (sme_id = auth.uid())
  with check (sme_id = auth.uid());

create policy "sme_postings: sme deletes own"
  on public.sme_postings for delete
  using (sme_id = auth.uid());

-- ---------------------------------------------------------------------------
-- continuity_briefs — double gate
-- ---------------------------------------------------------------------------
-- Owning SME AND reviewed_by_employee = true. An unreviewed brief is invisible
-- to everyone, including the SME who paid for it, because it may still contain
-- client names the outgoing employee has not had a chance to redact.
--
-- Writes deliberately have no policy: the handover interview and the review
-- step run through a server route using the service role key, since the
-- outgoing employee may not hold an account on the platform.

create policy "continuity_briefs: sme reads own reviewed"
  on public.continuity_briefs for select
  using (reviewed_by_employee and public.owns_posting(posting_id));

create policy "continuity_briefs: admin reads all"
  on public.continuity_briefs for select
  using (public.is_admin());

-- ---------------------------------------------------------------------------
-- matches — the SME's only window onto a candidate
-- ---------------------------------------------------------------------------
-- Postgres RLS filters rows, not columns, so the column restriction from the
-- task list is enforced structurally instead: this table physically holds only
-- derived fields. Nothing here can leak a raw skill matrix because no column
-- of it exists on the table.

create policy "matches: candidate reads own"
  on public.matches for select
  using (candidate_id = auth.uid());

create policy "matches: sme reads own postings"
  on public.matches for select
  using (public.owns_posting(posting_id));

create policy "matches: admin reads all"
  on public.matches for select
  using (public.is_admin());

create policy "matches: sme inserts on own postings"
  on public.matches for insert
  with check (public.owns_posting(posting_id));

-- Backs the 1-click shortlist/hire action.
create policy "matches: sme updates own postings"
  on public.matches for update
  using (public.owns_posting(posting_id))
  with check (public.owns_posting(posting_id));

-- ---------------------------------------------------------------------------
-- notifications
-- ---------------------------------------------------------------------------
-- Inserts come from the server-side notification check, which runs with the
-- service role key after a challenge is graded — so no insert policy here.

create policy "notifications: sme reads own"
  on public.notifications for select
  using (sme_id = auth.uid());

create policy "notifications: admin reads all"
  on public.notifications for select
  using (public.is_admin());

-- Marking a notification seen.
create policy "notifications: sme updates own"
  on public.notifications for update
  using (sme_id = auth.uid())
  with check (sme_id = auth.uid());

-- ---------------------------------------------------------------------------
-- payments
-- ---------------------------------------------------------------------------
-- Rows are written by the checkout route with the service role key so a client
-- can never mark its own payment paid.

create policy "payments: sme reads own"
  on public.payments for select
  using (sme_id = auth.uid());

create policy "payments: admin reads all"
  on public.payments for select
  using (public.is_admin());
