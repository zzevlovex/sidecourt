-- Sidecourt: open play history. Saves each finished session's final standings
-- so its players and its host can see the ranking again later and share it.
-- Run once after 04_delete_account.sql: SQL Editor > New query > paste > Run. Safe to run again.

create table if not exists public.sessions (
  id         uuid primary key, -- made by the app, so a retried upload is never saved twice
  manager_id uuid default auth.uid() references auth.users (id) on delete set null,
  ended_at   timestamptz not null,
  name       text not null check (char_length(name) between 1 and 100),
  sport      text not null check (sport in ('pickleball', 'badminton')),
  summary    jsonb not null,            -- standings and results, names only (what the final page shows)
  player_ids uuid[] not null default '{}', -- accounts that were checked in
  created_at timestamptz not null default now()
);
alter table public.sessions enable row level security;

-- Only people who were in the session, and its host, can see it.
drop policy if exists "players and host read sessions" on public.sessions;
create policy "players and host read sessions" on public.sessions
  for select to authenticated
  using ((select auth.uid()) = any (player_ids) or (select auth.uid()) = manager_id);

-- A host saves a session only for players they checked in (same rule as games).
drop policy if exists "host saves session for checked-in players" on public.sessions;
create policy "host saves session for checked-in players" on public.sessions
  for insert to authenticated
  with check (
    manager_id = (select auth.uid())
    and not exists (
      select 1 from unnest(player_ids) as linked(pid)
      where not exists (
        select 1 from public.checkins c
        where c.manager_id = (select auth.uid()) and c.player_id = linked.pid
      )
    )
  );

-- The host can remove a session they saved (used by "Undo" right after ending open play).
drop policy if exists "host deletes own session" on public.sessions;
create policy "host deletes own session" on public.sessions
  for delete to authenticated
  using ((select auth.uid()) = manager_id);

-- Deleting an account also unlinks it from saved sessions.
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid := auth.uid();
begin
  if v_id is null then
    raise exception 'Sign in first';
  end if;
  update public.games
     set players_a = array_remove(players_a, v_id),
         players_b = array_remove(players_b, v_id)
   where v_id = any (players_a || players_b);
  update public.sessions
     set player_ids = array_remove(player_ids, v_id)
   where v_id = any (player_ids);
  delete from auth.users where id = v_id;
end;
$$;

revoke all on function public.delete_my_account() from public;
grant execute on function public.delete_my_account() to authenticated;
