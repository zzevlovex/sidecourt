-- Sidecourt phase 6: scorer links. The manager shares a link for one court; a
-- helper opens it on their own phone (no account needed) and keeps that court's
-- score, which shows live on the manager's board.
-- Run once after 05_sessions.sql: SQL Editor > New query > paste > Run. Safe to run again.

-- One secret per shared court, e.g. {"1": "ABCDEFGH2345"}. Written by the manager's
-- device, never sent to players: get_lobby() does not return this column.
alter table public.lobbies add column if not exists score_keys jsonb not null default '{}'::jsonb;

-- The score being kept on a court right now (the scoreboard's match object).
create table if not exists public.court_scores (
  lobby_code text not null references public.lobbies (code) on delete cascade,
  court      int  not null check (court between 1 and 99),
  match      jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (lobby_code, court)
);
-- No policies on purpose: nobody reads or writes the table directly, only
-- through the two functions below.
alter table public.court_scores enable row level security;

-- Anyone with the lobby code can read the live scores (they are not secret).
create or replace function public.get_court_scores(p_code text)
returns table (court int, match jsonb, updated_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select s.court, s.match, s.updated_at from public.court_scores s where s.lobby_code = upper(btrim(p_code));
$$;
revoke all on function public.get_court_scores(text) from public;
grant execute on function public.get_court_scores(text) to anon, authenticated;

-- Writing needs that court's secret from the scorer link, and an open lobby.
-- Returns false when the link is wrong or the open play has ended.
create or replace function public.set_court_score(p_code text, p_court int, p_key text, p_match jsonb)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_key is null or length(p_key) < 8 or p_match is null or length(p_match::text) > 200000 then
    return false;
  end if;
  if not exists (
    select 1 from public.lobbies l
    where l.code = upper(btrim(p_code)) and l.open and l.score_keys ->> p_court::text = p_key
  ) then
    return false;
  end if;
  insert into public.court_scores (lobby_code, court, match)
  values (upper(btrim(p_code)), p_court, p_match)
  on conflict (lobby_code, court) do update set match = excluded.match, updated_at = now();
  return true;
end;
$$;
revoke all on function public.set_court_score(text, int, text, jsonb) from public;
grant execute on function public.set_court_score(text, int, text, jsonb) to anon, authenticated;
