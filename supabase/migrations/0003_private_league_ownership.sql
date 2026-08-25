-- Private league ownership for the current development stage.
-- Only the owner and Super Admin can see or modify a league.
-- League sharing is intentionally disabled for now.

alter table public.leagues
  add column if not exists owner_id uuid references auth.users(id) on delete cascade;

create index if not exists leagues_owner_idx
  on public.leagues (owner_id, is_active);

update public.leagues
set is_public = false;

do $$
declare
  owner_user_id uuid;
begin
  select id
  into owner_user_id
  from auth.users
  where lower(email) = lower('thanakrit_kas@hotmail.com')
  limit 1;

  if owner_user_id is null then
    raise exception 'Owner user thanakrit_kas@hotmail.com was not found in auth.users';
  end if;

  insert into public.leagues (name, slug, owner_id, is_public, is_active)
  values
    ('Alcohol League', 'alcohol-league', owner_user_id, false, true),
    ('Var38 League', 'var38-league', owner_user_id, false, true)
  on conflict (slug) do update set
    name = excluded.name,
    owner_id = excluded.owner_id,
    is_public = false,
    is_active = true;
end;
$$;

create or replace function public.has_league_role(
  target_league_id uuid,
  required_role text
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_role('super_admin')
    or exists (
      select 1
      from public.leagues
      where id = target_league_id
        and owner_id = auth.uid()
    );
$$;

drop policy if exists leagues_select_public_or_member on public.leagues;
drop policy if exists leagues_admin_write on public.leagues;
create policy leagues_select_owner_or_admin
on public.leagues for select
using (owner_id = auth.uid() or public.has_role('super_admin'));

create policy leagues_owner_or_admin_write
on public.leagues for all
using (owner_id = auth.uid() or public.has_role('super_admin'))
with check (owner_id = auth.uid() or public.has_role('super_admin'));

drop policy if exists league_memberships_select_self_or_admin on public.league_memberships;
drop policy if exists league_memberships_admin_write on public.league_memberships;
create policy league_memberships_admin_only
on public.league_memberships for all
using (public.has_role('super_admin'))
with check (public.has_role('super_admin'));

drop policy if exists teams_select_public_or_member on public.teams;
drop policy if exists teams_operator_write on public.teams;
create policy teams_select_owner_or_admin
on public.teams for select
using (public.has_league_role(league_id, 'operator'));

create policy teams_owner_or_admin_write
on public.teams for all
using (public.has_league_role(league_id, 'operator'))
with check (public.has_league_role(league_id, 'operator'));

drop policy if exists matches_select_public_or_member on public.matches;
drop policy if exists matches_operator_write on public.matches;
create policy matches_select_owner_or_admin
on public.matches for select
using (public.has_league_role(league_id, 'operator'));

create policy matches_owner_or_admin_write
on public.matches for all
using (public.has_league_role(league_id, 'operator'))
with check (public.has_league_role(league_id, 'operator'));

revoke select on public.leagues, public.teams, public.matches from anon;
grant select on public.leagues, public.teams, public.matches to authenticated;
