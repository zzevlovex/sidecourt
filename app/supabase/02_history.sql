-- Sidecourt phase 2: check-in by player code, and game history.
-- Run once after 01_accounts.sql: SQL Editor > New query > paste > Run. Safe to run again.

-- Which players a manager has checked in by code. A manager can only save
-- games for these players, so nobody can write games into a stranger's history.
create table if not exists public.checkins (
  manager_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  player_id  uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (manager_id, player_id)
);
alter table public.checkins enable row level security;

drop policy if exists "managers read own checkins" on public.checkins;
create policy "managers read own checkins" on public.checkins
  for select to authenticated using ((select auth.uid()) = manager_id);

-- Check a player in by their public code: returns their id and name, and
-- remembers that this manager checked them in. Signed-in managers only.
create or replace function public.check_in(p_code text)
returns table (player_id uuid, display_name text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_name text;
begin
  if auth.uid() is null then
    raise exception 'Sign in to check players in by code';
  end if;
  select p.id, p.display_name into v_id, v_name
  from public.profiles p
  where p.player_code = upper(btrim(p_code));
  if v_id is null then
    return; -- no such code: empty result
  end if;
  insert into public.checkins (manager_id, player_id) values (auth.uid(), v_id)
  on conflict do nothing;
  return query select v_id, v_name;
end;
$$;

revoke all on function public.check_in(text) from public;
grant execute on function public.check_in(text) to authenticated;

-- One row per finished game. Names are kept as they were on the day;
-- players_a / players_b hold the account ids of linked players (others stay names only).
create table if not exists public.games (
  id           uuid primary key, -- made by the app, so a retried upload is never saved twice
  recorded_by  uuid default auth.uid() references auth.users (id) on delete set null,
  played_at    timestamptz not null,
  session_name text not null check (char_length(session_name) between 1 and 100),
  sport        text not null check (sport in ('pickleball', 'badminton')),
  court        int,
  team_a       text[] not null,
  team_b       text[] not null,
  players_a    uuid[] not null default '{}',
  players_b    uuid[] not null default '{}',
  score_a      int check (score_a >= 0),
  score_b      int check (score_b >= 0),
  winner       text check (winner in ('a', 'b')),
  created_at   timestamptz not null default now()
);
alter table public.games enable row level security;

-- Players see the games they played in; managers see the games they recorded.
drop policy if exists "players and recorder read games" on public.games;
create policy "players and recorder read games" on public.games
  for select to authenticated
  using ((select auth.uid()) = any (players_a || players_b) or (select auth.uid()) = recorded_by);

-- Managers save games only for players they checked in by code.
drop policy if exists "record games for checked-in players" on public.games;
create policy "record games for checked-in players" on public.games
  for insert to authenticated
  with check (
    recorded_by = (select auth.uid())
    and not exists (
      select 1 from unnest(players_a || players_b) as linked(pid)
      where not exists (
        select 1 from public.checkins c
        where c.manager_id = (select auth.uid()) and c.player_id = linked.pid
      )
    )
  );
