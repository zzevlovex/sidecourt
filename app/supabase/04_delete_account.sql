-- Sidecourt: players can delete their own account.
-- Run once after 03_lobby.sql: SQL Editor > New query > paste > Run. Safe to run again.
--
-- Deleting the sign-in record removes, through "on delete cascade": the profile,
-- check-ins, lobbies they ran and their join requests. Games they recorded stay for
-- the other players (recorded_by becomes empty). Their account id is also taken
-- out of every game, so nothing links back to them; their name stays only as plain
-- text in other players' past games, as it was written on the day.
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
  delete from auth.users where id = v_id;
end;
$$;

revoke all on function public.delete_my_account() from public;
grant execute on function public.delete_my_account() to authenticated;
