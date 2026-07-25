-- Skill-Connect Ethiopia — how a company refers to a candidate
--
-- Pillar 3's ranked results need to label each row, but there is deliberately no
-- profiles select policy for an SME, so they cannot read a name. That gap is
-- correct and should stay: RLS filters rows, not columns, so any policy wide
-- enough to expose full_name would also hand over phone and bio, and Section 9
-- says a company reads derived output only.
--
-- So the label becomes derived output too. matches is already documented as the
-- single window an SME has onto a candidate; this adds one more derived column
-- to it rather than opening a second read path.
--
-- opt_in_discoverable decides which label is used:
--   opted in  -> their name, which is what opting in was for
--   opted out -> "Candidate A", "Candidate B", ... within that posting
--
-- Both are written by a trigger, not by the caller, so an SME cannot supply
-- their own label and a client that forgets the column cannot leak or lose one.

alter table public.matches
  add column if not exists anonymous_label text,
  add column if not exists candidate_label text;

comment on column public.matches.anonymous_label is
  'Stable "Candidate A" style label, assigned once per posting. Used whenever the candidate is not discoverable.';
comment on column public.matches.candidate_label is
  'What the SME actually sees. Their real name only while opt_in_discoverable is true.';

-- ---------------------------------------------------------------------------
-- Label assignment
-- ---------------------------------------------------------------------------
-- SECURITY DEFINER because the SME inserting the match cannot read the
-- candidate's profile, which is the whole point of this migration.

create or replace function public.assign_match_labels()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_position   int;
  v_discoverable boolean;
  v_full_name  text;
begin
  -- Assigned once and never recomputed, so a candidate who opts out later gets
  -- the same letter back rather than appearing to be a new person.
  if new.anonymous_label is null then
    select count(*) into v_position
    from public.matches
    where posting_id = new.posting_id;

    new.anonymous_label := 'Candidate ' || chr(65 + (v_position % 26));
  end if;

  select p.opt_in_discoverable, nullif(p.full_name, '')
    into v_discoverable, v_full_name
  from public.profiles p
  where p.id = new.candidate_id;

  new.candidate_label := case
    when coalesce(v_discoverable, false) and v_full_name is not null then v_full_name
    else new.anonymous_label
  end;

  return new;
end;
$$;

drop trigger if exists on_match_assign_labels on public.matches;

create trigger on_match_assign_labels
  before insert or update of candidate_id on public.matches
  for each row execute function public.assign_match_labels();

-- ---------------------------------------------------------------------------
-- Opting out has to actually take the name back
-- ---------------------------------------------------------------------------
-- Without this, "make me undiscoverable" would only stop future matches while
-- every company that already matched kept the name on screen.

create or replace function public.resync_match_labels()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.matches m
  set candidate_label = case
        when new.opt_in_discoverable and nullif(new.full_name, '') is not null
          then new.full_name
        else m.anonymous_label
      end
  where m.candidate_id = new.id;

  return new;
end;
$$;

drop trigger if exists on_profile_resync_match_labels on public.profiles;

create trigger on_profile_resync_match_labels
  after update of opt_in_discoverable, full_name on public.profiles
  for each row execute function public.resync_match_labels();

-- ---------------------------------------------------------------------------
-- Backfill
-- ---------------------------------------------------------------------------

with ordered as (
  select
    id,
    'Candidate ' || chr(65 + ((row_number() over (
      partition by posting_id order by created_at, id
    ) - 1)::int % 26)) as label
  from public.matches
  where anonymous_label is null
)
update public.matches m
set anonymous_label = ordered.label
from ordered
where m.id = ordered.id;

update public.matches m
set candidate_label = case
      when p.opt_in_discoverable and nullif(p.full_name, '') is not null
        then p.full_name
      else m.anonymous_label
    end
from public.profiles p
where p.id = m.candidate_id
  and m.candidate_label is distinct from case
      when p.opt_in_discoverable and nullif(p.full_name, '') is not null
        then p.full_name
      else m.anonymous_label
    end;

-- The SME must not be able to write these; the triggers own them. Reads come
-- from the existing "matches: sme reads own postings" policy.
revoke update (anonymous_label, candidate_label) on public.matches from authenticated;
