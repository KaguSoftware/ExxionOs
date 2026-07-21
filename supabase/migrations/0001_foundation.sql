-- 0001_foundation.sql — ExxionOs foundation
--
-- Two trusted users, no roles, no memberships, no showcase mode. RLS is still
-- ENABLED on every table so nothing is reachable with the anon key, but the
-- policies are deliberately simple: any authenticated user may read and write
-- domain data. The one exception is `profiles`, where a user may only update
-- their OWN row, and only specific columns.

-- ---------------------------------------------------------------------------
-- helpers
-- ---------------------------------------------------------------------------

create schema if not exists private;

-- Every table with an updated_at gets this trigger, so the column can never
-- drift from reality by being forgotten in an UPDATE.
create or replace function private.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------

create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text not null default '',
  avatar_url  text,
  -- locale/theme live on the profile so a signed-in user gets their own
  -- settings on a new device; the cookie is only a first-paint accelerator.
  locale      text not null default 'en' check (locale in ('en', 'fa')),
  theme       text not null default 'system' check (theme in ('light', 'dark', 'system')),
  color       text not null default '#6366f1',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function private.set_updated_at();

-- An account created by hand in the Supabase dashboard must just work, so the
-- profile row is created by a trigger rather than by application code.
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

alter table public.profiles enable row level security;

drop policy if exists profiles_select_all on public.profiles;
create policy profiles_select_all
  on public.profiles for select
  to authenticated
  using (true);

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own
  on public.profiles for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- ⚠️ Column-level grants, inherited from a real KaguOs incident (its 0015):
-- an RLS policy scopes the ROW, a GRANT scopes the COLUMN, and they are
-- enforced independently. Revoking table-wide UPDATE and re-granting per
-- column means a future column is NOT user-writable until someone grants it
-- deliberately. Adding a user-editable column to profiles therefore requires
-- BOTH a policy (already covers it) AND a new grant line here — the grant is
-- the half that gets forgotten, and the symptom is a bare
-- "permission denied for table profiles".
revoke update on public.profiles from authenticated;
grant update (full_name, avatar_url, locale, theme, color) on public.profiles to authenticated;

-- ---------------------------------------------------------------------------
-- reminders
-- ---------------------------------------------------------------------------
-- Personal notes with an optional due date. Used by the dashboard now and by
-- Equipment (maintenance due) from phase 4 onward. `due_on` is nullable and
-- that nullability carries meaning: null = a note to self, dated = something
-- that can become overdue and appear in "Needs you".

create table if not exists public.reminders (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references public.profiles (id) on delete cascade,
  body        text not null,
  due_on      date,
  done_at     timestamptz,
  -- Optional back-link to whatever the reminder is about (equipment, order…).
  -- Kept as a loose pair rather than a FK so any section can use it without a
  -- migration; the UI resolves it only when it recognises the type.
  source_type text,
  source_id   uuid,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

drop trigger if exists reminders_set_updated_at on public.reminders;
create trigger reminders_set_updated_at
  before update on public.reminders
  for each row execute function private.set_updated_at();

-- Dated, unfinished reminders are what the dashboard asks for on every load.
create index if not exists reminders_owner_due_idx
  on public.reminders (owner_id, due_on)
  where done_at is null;

alter table public.reminders enable row level security;

drop policy if exists reminders_all on public.reminders;
create policy reminders_all
  on public.reminders for all
  to authenticated
  using (true)
  with check (true);
