-- Sidecourt phase 3: open play lobbies. Players follow a session from their own
-- phones with a lobby code, and can ask to join the line.
-- Run once after 02_history.sql: SQL Editor > New query > paste > Run. Safe to run again.

-- The live view of one open play session, written by the manager's device.
-- state holds what players see (courts, line, results): names only, no account ids.
create table if not exists public.lobbies (
  code       text primary key check (code ~ '^[2-9A-HJ-NP-Z]{6}$'),
  manager_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  state      jsonb not null,
  open       boolean not null default true,
  updated_at timestamptz not null default now()
);
alter table public.lobbies enable row level security;

-- Only the manager writes their lobby. Nobody can list lobbies: viewers need
-- the code and go through get_lobby() below.
drop policy if exists "manager manages own lobby" on public.lobbies;
create policy "manager manages own lobby" on public.lobbies
  for all to authenticated
  using ((select auth.uid()) = manager_id)
  with check ((select auth.uid()) = manager_id);

-- Anyone with the code can see the lobby (signed in or not).
create or replace function public.get_lobby(p_code text)
returns table (state jsonb, open boolean, updated_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select l.state, l.open, l.updated_at from public.lobbies l where l.code = upper(btrim(p_code));
$$;
revoke all on function public.get_lobby(text) from public;
grant execute on function public.get_lobby(text) to anon, authenticated;

-- Players asking to join the line. The manager's app picks these up and adds them.
create table if not exists public.lobby_joins (
  lobby_code   text not null references public.lobbies (code) on delete cascade,
  player_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  display_name text not null,
  created_at   timestamptz not null default now(),
  primary key (lobby_code, player_id)
);
alter table public.lobby_joins enable row level security;

drop policy if exists "manager reads and clears joins" on public.lobby_joins;
create policy "manager reads and clears joins" on public.lobby_joins
  for all to authenticated
  using (exists (select 1 from public.lobbies l where l.code = lobby_code and l.manager_id = (select auth.uid())));

-- A signed-in player joins a lobby: records the request and counts as being
-- checked in by that manager (so their games can go into their history).
create or replace function public.join_lobby(p_code text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_manager uuid;
  v_name text;
begin
  if auth.uid() is null then
    raise exception 'Sign in to join the line';
  end if;
  select l.manager_id into v_manager from public.lobbies l where l.code = upper(btrim(p_code)) and l.open;
  if v_manager is null then
    return 'closed';
  end if;
  select p.display_name into v_name from public.profiles p where p.id = auth.uid();
  if v_name is null then
    raise exception 'Create your profile first';
  end if;
  insert into public.lobby_joins (lobby_code, player_id, display_name)
  values (upper(btrim(p_code)), auth.uid(), v_name)
  on conflict do nothing;
  insert into public.checkins (manager_id, player_id) values (v_manager, auth.uid())
  on conflict do nothing;
  return 'ok';
end;
$$;
revoke all on function public.join_lobby(text) from public;
grant execute on function public.join_lobby(text) to authenticated;
