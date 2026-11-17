-- Sidecourt accounts (phase 1). Run once in Supabase: SQL Editor > New query > paste > Run.
-- Safe to run again: it only creates what is missing.

-- One profile per account.
create table if not exists public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  key_id       text not null unique check (key_id ~ '^[2-9A-HJ-NP-Z]{8}$'),    -- first half of the account key, to find the account
  player_code  text not null unique check (player_code ~ '^[2-9A-HJ-NP-Z]{6}$'), -- public, for check-in
  display_name text not null check (char_length(btrim(display_name)) between 1 and 40),
  created_at   timestamptz not null default now()
);

-- Row Level Security: people can only see and change their own profile.
alter table public.profiles enable row level security;

drop policy if exists "read own profile" on public.profiles;
create policy "read own profile" on public.profiles
  for select to authenticated using ((select auth.uid()) = id);

drop policy if exists "create own profile" on public.profiles;
create policy "create own profile" on public.profiles
  for insert to authenticated with check ((select auth.uid()) = id);

drop policy if exists "update own profile" on public.profiles;
create policy "update own profile" on public.profiles
  for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

-- Signing in with only a key: the app sends the key id (first half of the key)
-- and gets back the account's sign-in address. The full key is still needed as
-- the password, so knowing a key id alone does not let anyone in.
create or replace function public.login_email(p_key_id text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select u.email
  from auth.users u
  join public.profiles p on p.id = u.id
  where p.key_id = upper(p_key_id);
$$;

revoke all on function public.login_email(text) from public;
grant execute on function public.login_email(text) to anon, authenticated;
