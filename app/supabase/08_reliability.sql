-- Sidecourt reliability update. Run once after 07_security.sql:
-- SQL Editor > New query > paste > Run. Safe to run again.
--
-- 1. Lobbies send their data only when it has changed (far less data used).
-- 2. The manager's full session is kept online, so it can be resumed on any device.
-- 3. App errors are recorded, so problems can be seen and fixed.
-- 4. A record of which of these files have been run.

/* ---------- 1. Send data only when it changed ---------- */

-- p_since: the updated_at the phone already has. When it still matches, state is left empty.
create or replace function public.get_lobby_changes(p_code text, p_since timestamptz default null)
returns table (state jsonb, open boolean, updated_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select case when l.updated_at is distinct from p_since then l.state end, l.open, l.updated_at
  from public.lobbies l
  where l.code = upper(btrim(p_code)) and l.updated_at > now() - interval '2 days';
$$;
revoke all on function public.get_lobby_changes(text, timestamptz) from public;
grant execute on function public.get_lobby_changes(text, timestamptz) to anon, authenticated;

create or replace function public.get_court_score_changes(p_code text, p_since timestamptz default null)
returns table (court int, match jsonb, updated_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select s.court, s.match, s.updated_at
  from public.court_scores s
  join public.lobbies l on l.code = s.lobby_code
  where s.lobby_code = upper(btrim(p_code)) and l.open
    and (p_since is null or s.updated_at > p_since)
  order by s.updated_at;
$$;
revoke all on function public.get_court_score_changes(text, timestamptz) from public;
grant execute on function public.get_court_score_changes(text, timestamptz) to anon, authenticated;

/* ---------- 2. Resume a session on another device ---------- */

-- Only the manager can read this column (the lobby's existing rule), and the
-- public lobby functions never return it.
alter table public.lobbies add column if not exists private_state jsonb;
alter table public.lobbies drop constraint if exists lobbies_private_size;
alter table public.lobbies add constraint lobbies_private_size
  check (private_state is null or octet_length(private_state::text) <= 1500000) not valid;

/* ---------- Key sign-in addresses ---------- */

-- Older accounts have the first half of their key inside their hidden sign-in
-- address. This replaces it with the account's one-way lookup id. Only hidden
-- addresses are touched: a real recovery email is left alone.
create or replace function public.move_login_address()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := auth.uid();
  v_new text;
begin
  if v_me is null then
    raise exception 'Sign in first';
  end if;
  select lower(p.key_id) || '@keys.sidecourt.invalid' into v_new from public.profiles p where p.id = v_me;
  if v_new is null then
    return;
  end if;
  update auth.users u set email = v_new
   where u.id = v_me and u.email like '%@keys.sidecourt.invalid' and u.email <> v_new;
  if found then
    update auth.identities i
       set identity_data = i.identity_data || jsonb_build_object('email', v_new)
     where i.user_id = v_me and i.provider = 'email';
  end if;
end;
$$;
revoke all on function public.move_login_address() from public, anon;
grant execute on function public.move_login_address() to authenticated;

/* ---------- 3. App errors ---------- */

create table if not exists public.client_errors (
  id      bigint generated always as identity primary key,
  at      timestamptz not null default now(),
  message text not null check (char_length(message) <= 300),
  path    text check (char_length(path) <= 100),
  version text check (char_length(version) <= 40)
);
create index if not exists client_errors_at on public.client_errors (at);
-- No policies: read it in the Supabase dashboard. The app can only add through the function below.
alter table public.client_errors enable row level security;

create or replace function public.report_client_error(p_message text, p_path text, p_version text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- At most 500 a day in total, and only the last 30 days are kept.
  if (select count(*) from public.client_errors e where e.at > now() - interval '1 day') >= 500 then
    return;
  end if;
  delete from public.client_errors e where e.at < now() - interval '30 days';
  insert into public.client_errors (message, path, version)
  values (left(coalesce(p_message, 'unknown'), 300), left(p_path, 100), left(p_version, 40));
end;
$$;
revoke all on function public.report_client_error(text, text, text) from public;
grant execute on function public.report_client_error(text, text, text) to anon, authenticated;

/* ---------- 4. Which files have been run ---------- */

create table if not exists public.schema_migrations (
  file   text primary key,
  ran_at timestamptz not null default now()
);
alter table public.schema_migrations enable row level security;
insert into public.schema_migrations (file) values
  ('01_accounts'), ('02_history'), ('03_lobby'), ('04_delete_account'), ('05_sessions'),
  ('06_court_scores'), ('07_security'), ('08_reliability')
on conflict do nothing;
