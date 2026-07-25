-- Safety net: force RLS on any future table in the public schema.
--
-- Tables created through the Supabase dashboard get RLS by default, but tables
-- created from the SQL editor or a migration do not. With three developers
-- working against one database under time pressure, a table created without
-- RLS would be readable by anyone holding the anon key. This event trigger
-- makes that mistake impossible rather than relying on everyone remembering.
--
-- Our own tables already enable RLS explicitly in 0001; re-enabling is a no-op.

create or replace function public.enable_rls_on_new_tables()
returns event_trigger
language plpgsql
as $$
declare
  obj record;
begin
  for obj in
    select * from pg_event_trigger_ddl_commands()
    where command_tag = 'CREATE TABLE'
  loop
    if obj.schema_name = 'public' then
      execute format(
        'alter table %s enable row level security',
        obj.object_identity
      );
    end if;
  end loop;
end;
$$;

drop event trigger if exists auto_enable_rls;

create event trigger auto_enable_rls
  on ddl_command_end
  when tag in ('CREATE TABLE')
  execute function public.enable_rls_on_new_tables();
