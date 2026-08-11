-- Remaps seeded score and threshold keys onto the frozen competency vocabulary.
--
-- Why this is needed: the spec gives two different score vocabularies. Section 2
-- writes a Sandbox Score as prompt_engineering / task_accuracy / communication,
-- while the Role Skill Template example uses excel_basics / ai_prompt_literacy /
-- customer_comms. lib/sandbox/competencies.ts reconciles them into six frozen
-- keys, and normalizeScores() drops anything else.
--
-- The live seed was written against the un-reconciled spec, so
-- role_skill_templates.thresholds_json referenced keys no candidate could ever
-- hold. The match engine compares the two blobs key by key, so every template
-- matched zero candidates — silently, because a dropped key is not an error.
--
--   prompt_engineering -> ai_prompt_literacy
--   communication      -> customer_comms
--   excel_basics       -> data_tools
--
-- Where a row carried both a legacy key and its frozen equivalent, the higher
-- score wins, matching how bestScores() treats repeated evidence elsewhere.
--
-- Idempotent: legacy keys are gone after the first run, so re-running is a
-- no-op. This is seed data only. It creates no schema, and lives outside
-- supabase/migrations/ because migrations are Dev 1's alone.
--
-- Run with: psql "$DBURL" -v ON_ERROR_STOP=1 -f scripts/normalize-seed-vocabulary.sql

begin;

create or replace function pg_temp.frozen_key(k text)
returns text
language sql
immutable
as $$
  select case k
    when 'prompt_engineering' then 'ai_prompt_literacy'
    when 'communication'      then 'customer_comms'
    when 'excel_basics'       then 'data_tools'
    else k
  end;
$$;

create or replace function pg_temp.normalize_scores(src jsonb)
returns jsonb
language sql
immutable
as $$
  select coalesce(jsonb_object_agg(k, v), '{}'::jsonb)
  from (
    select pg_temp.frozen_key(key) as k, max(value::numeric) as v
    from jsonb_each_text(src)
    where pg_temp.frozen_key(key) in (
      'ai_prompt_literacy', 'task_accuracy', 'customer_comms',
      'data_tools', 'process_thinking', 'adaptability'
    )
    group by 1
  ) mapped;
$$;

update public.sandbox_scores
set scores_json = pg_temp.normalize_scores(scores_json)
where scores_json is distinct from pg_temp.normalize_scores(scores_json);

update public.role_skill_templates
set thresholds_json = pg_temp.normalize_scores(thresholds_json)
where thresholds_json is distinct from pg_temp.normalize_scores(thresholds_json);

-- A template whose thresholds all dropped out would match everyone rather than
-- nobody, which is the more dangerous direction. Refuse to leave that behind.
do $$
declare
  empty_count int;
begin
  select count(*) into empty_count
  from public.role_skill_templates
  where thresholds_json = '{}'::jsonb;

  if empty_count > 0 then
    raise exception
      'ABORT: % template(s) have no thresholds left after remapping. '
      'Their keys were not in the frozen vocabulary and had no mapping.',
      empty_count;
  end if;
end $$;

commit;
