-- Skill-Connect Ethiopia — profile creation on signup
--
-- Creating the profile row from a trigger rather than from the client keeps it
-- reliable across every signup path (email, phone, confirmation-pending) and
-- means a half-finished signup can never leave an auth user with no profile,
-- which would break role routing at login.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role_text text;
  v_role public.user_role;
begin
  v_role_text := new.raw_user_meta_data ->> 'role';

  -- Anything unrecognised falls back to job_seeker. 'admin' is deliberately not
  -- accepted here: Section 4 requires admin to be granted out of band, never
  -- claimed by a signup payload the client controls.
  if coalesce(v_role_text, '') not in ('job_seeker', 'sme') then
    v_role_text := 'job_seeker';
  end if;

  v_role := v_role_text::public.user_role;

  insert into public.profiles (id, role, full_name, phone, region)
  values (
    new.id,
    v_role,
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(nullif(new.raw_user_meta_data ->> 'phone', ''), new.phone),
    nullif(new.raw_user_meta_data ->> 'region', '')
  )
  on conflict (id) do nothing;

  -- An SME needs a company profile to exist immediately, because verified =
  -- false is what represents the "pending_verification" state the admin console
  -- approves against.
  if v_role = 'sme' then
    insert into public.company_profiles (sme_id, company_name)
    values (
      new.id,
      coalesce(nullif(new.raw_user_meta_data ->> 'company_name', ''), 'Unnamed company')
    )
    on conflict (sme_id) do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
