-- Column-level privileges, closing a privilege-escalation gap in 0002.
--
-- RLS decides which ROWS you can touch, not which COLUMNS. The "profiles:
-- update own" policy correctly limits a user to their own row, but nothing
-- stopped them from setting role = 'admin' on it — a one-request escalation to
-- the admin console. The insert policy blocked that case; update did not.
--
-- Postgres column grants are the right tool: revoke UPDATE on the whole table,
-- then grant it back only on the fields a user legitimately edits about
-- themselves. Role changes now have to go through the service role, which is
-- exactly what /admin/promote already does.

revoke update on public.profiles from authenticated, anon;

grant update (full_name, bio, phone, region, opt_in_discoverable)
  on public.profiles to authenticated;

-- Same reasoning on matches. An SME legitimately drives the shortlist/hire
-- action, but should not be able to rewrite the match score or gap analysis
-- the engine produced — those are the numbers they are being sold on.
revoke update on public.matches from authenticated, anon;

grant update (status) on public.matches to authenticated;

-- An SME marks a notification read; nothing else about it is theirs to change.
revoke update on public.notifications from authenticated, anon;

grant update (seen) on public.notifications to authenticated;
