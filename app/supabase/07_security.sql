-- Sidecourt security update. Run once after 06_court_scores.sql:
-- SQL Editor > New query > paste > Run. Safe to run again.
--
-- 1. Size limits, so one account cannot fill the database.
-- 2. Daily limits on new rows, and limits on guessing codes.
-- 3. Players can remove anything from their history, and block a host who misuses their code.
-- 4. Lobbies stop being readable by code two days after their last change.

/* ---------- 1. Size limits (existing rows are left alone) ---------- */

alter table public.lobbies add column if not exists created_at timestamptz not null default now();

alter table public.lobbies drop constraint if exists lobbies_state_size;
alter table public.lobbies add constraint lobbies_state_size
  check (octet_length(state::text) <= 1000000) not valid;

alter table public.sessions drop constraint if exists sessions_size;
alter table public.sessions add constraint sessions_size
  check (octet_length(summary::text) <= 1000000 and cardinality(player_ids) <= 200) not valid;

alter table public.games drop constraint if exists games_size;
alter table public.games add constraint games_size
  check (
    cardinality(team_a) <= 2 and cardinality(team_b) <= 2
    and cardinality(players_a) <= 2 and cardinality(players_b) <= 2
    and char_length(array_to_string(team_a || team_b, '')) <= 1000
  ) not valid;

/* ---------- 2. Limits ---------- */

create index if not exists lobbies_manager_created on public.lobbies (manager_id, created_at);
create index if not exists sessions_manager_created on public.sessions (manager_id, created_at);
create index if not exists games_recorder_created on public.games (recorded_by, created_at);

-- New rows one account may add per day. Far above what a real club needs.
-- Arguments: the limit, then the column holding the account.
create or replace function public.enforce_daily_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := auth.uid();
  v_count int;
begin
  if v_me is null then
    return new;
  end if;
  execute format('select count(*) from public.%I t where t.%I = $1 and t.created_at > now() - interval ''1 day''', tg_table_name, tg_argv[1])
    into v_count using v_me;
  if v_count >= tg_argv[0]::int then
    raise exception 'Daily limit reached. Try again tomorrow.';
  end if;
  return new;
end;
$$;
revoke all on function public.enforce_daily_limit() from public, anon, authenticated;

drop trigger if exists daily_limit on public.lobbies;
create trigger daily_limit before insert on public.lobbies
  for each row execute function public.enforce_daily_limit('30', 'manager_id');
drop trigger if exists daily_limit on public.sessions;
create trigger daily_limit before insert on public.sessions
  for each row execute function public.enforce_daily_limit('30', 'manager_id');
drop trigger if exists daily_limit on public.games;
create trigger daily_limit before insert on public.games
  for each row execute function public.enforce_daily_limit('3000', 'recorded_by');

-- Recent tries per account, so codes cannot be guessed at speed. Nobody reads this directly.
create table if not exists public.rate_hits (
  user_id uuid not null references auth.users (id) on delete cascade,
  action  text not null,
  at      timestamptz not null default now()
);
create index if not exists rate_hits_lookup on public.rate_hits (user_id, action, at);
alter table public.rate_hits enable row level security;

create or replace function public.hit_limit(p_action text, p_max int, p_window interval)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count int;
begin
  delete from public.rate_hits r where r.user_id = auth.uid() and r.at < now() - interval '1 day';
  select count(*) into v_count from public.rate_hits r
   where r.user_id = auth.uid() and r.action = p_action and r.at > now() - p_window;
  if v_count >= p_max then
    raise exception 'Too many tries. Wait a while and try again.';
  end if;
  insert into public.rate_hits (user_id, action) values (auth.uid(), p_action);
end;
$$;
revoke all on function public.hit_limit(text, int, interval) from public, anon, authenticated;

/* ---------- 3. Players control their own history ---------- */

-- Hosts a player has blocked: they cannot check that player in by code.
create table if not exists public.host_blocks (
  player_id  uuid not null references auth.users (id) on delete cascade,
  manager_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (player_id, manager_id)
);
alter table public.host_blocks enable row level security;

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
  perform public.hit_limit('check_in', 120, interval '1 hour');
  select p.id, p.display_name into v_id, v_name
  from public.profiles p
  where p.player_code = upper(btrim(p_code));
  if v_id is null then
    return; -- no such code: empty result
  end if;
  if exists (select 1 from public.host_blocks b where b.player_id = v_id and b.manager_id = auth.uid()) then
    return; -- looks the same as an unknown code
  end if;
  insert into public.checkins (manager_id, player_id) values (auth.uid(), v_id)
  on conflict do nothing;
  return query select v_id, v_name;
end;
$$;
revoke all on function public.check_in(text) from public, anon;
grant execute on function public.check_in(text) to authenticated;

-- Joining a host's lobby is the player's own choice, so it also lifts a block.
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
  perform public.hit_limit('join_lobby', 60, interval '1 hour');
  select l.manager_id into v_manager from public.lobbies l where l.code = upper(btrim(p_code)) and l.open;
  if v_manager is null then
    return 'closed';
  end if;
  select p.display_name into v_name from public.profiles p where p.id = auth.uid();
  if v_name is null then
    raise exception 'Create your profile first';
  end if;
  delete from public.host_blocks b where b.player_id = auth.uid() and b.manager_id = v_manager;
  insert into public.lobby_joins (lobby_code, player_id, display_name)
  values (upper(btrim(p_code)), auth.uid(), v_name)
  on conflict do nothing;
  insert into public.checkins (manager_id, player_id) values (v_manager, auth.uid())
  on conflict do nothing;
  return 'ok';
end;
$$;
revoke all on function public.join_lobby(text) from public, anon;
grant execute on function public.join_lobby(text) to authenticated;

-- "Not me": takes the player out of this game or session. If another host saved
-- it, everything from that host goes too and the host is blocked.
create or replace function public.remove_from_history(p_table text, p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := auth.uid();
  v_host uuid;
begin
  if v_me is null then
    raise exception 'Sign in first';
  end if;
  if p_table = 'games' then
    select g.recorded_by into v_host from public.games g where g.id = p_id and v_me = any (g.players_a || g.players_b);
  elsif p_table = 'sessions' then
    select s.manager_id into v_host from public.sessions s where s.id = p_id and v_me = any (s.player_ids);
  else
    raise exception 'Unknown history type';
  end if;
  if not found then
    return;
  end if;

  update public.games g
     set players_a = array_remove(g.players_a, v_me), players_b = array_remove(g.players_b, v_me)
   where v_me = any (g.players_a || g.players_b)
     and ((p_table = 'games' and g.id = p_id) or (v_host is not null and v_host <> v_me and g.recorded_by = v_host));
  update public.sessions s
     set player_ids = array_remove(s.player_ids, v_me)
   where v_me = any (s.player_ids)
     and ((p_table = 'sessions' and s.id = p_id) or (v_host is not null and v_host <> v_me and s.manager_id = v_host));

  if v_host is not null and v_host <> v_me then
    insert into public.host_blocks (player_id, manager_id) values (v_me, v_host) on conflict do nothing;
    delete from public.checkins c where c.manager_id = v_host and c.player_id = v_me;
  end if;
end;
$$;
revoke all on function public.remove_from_history(text, uuid) from public, anon;
grant execute on function public.remove_from_history(text, uuid) to authenticated;

/* ---------- 4. Old lobbies stop being readable ---------- */

create or replace function public.get_lobby(p_code text)
returns table (state jsonb, open boolean, updated_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select l.state, l.open, l.updated_at from public.lobbies l
  where l.code = upper(btrim(p_code)) and l.updated_at > now() - interval '2 days';
$$;
revoke all on function public.get_lobby(text) from public;
grant execute on function public.get_lobby(text) to anon, authenticated;

create or replace function public.get_court_scores(p_code text)
returns table (court int, match jsonb, updated_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select s.court, s.match, s.updated_at
  from public.court_scores s
  join public.lobbies l on l.code = s.lobby_code
  where s.lobby_code = upper(btrim(p_code)) and l.open;
$$;
revoke all on function public.get_court_scores(text) from public;
grant execute on function public.get_court_scores(text) to anon, authenticated;
