-- 0002_backfill_profiles.sql
--
-- 0001 added a trigger that creates a profile row whenever an auth user is
-- inserted. Triggers only fire on NEW inserts, so any account that already
-- existed when 0001 ran has no profile — and `getSessionContext` redirects to
-- /login when the profile is missing, which for that user is an unbreakable
-- login loop.
--
-- This backfills them. It is idempotent (on conflict do nothing), so it is
-- safe to re-run and safe to keep in the migration history.

insert into public.profiles (id, full_name)
select
  u.id,
  coalesce(u.raw_user_meta_data ->> 'full_name', split_part(u.email, '@', 1))
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null
on conflict (id) do nothing;
