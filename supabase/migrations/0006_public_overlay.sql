-- Public, read-only Overlay access per league.
-- The existing leagues.is_public column is used as the explicit publish switch.
-- This does not grant anonymous access to the underlying matches or teams tables.

create or replace function public.set_league_public_overlay(
  target_league_id uuid,
  enabled boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  update public.leagues
  set is_public = enabled
  where id = target_league_id
    and (owner_id = auth.uid() or public.has_role('super_admin'));

  if not found then
    raise exception 'League owner permission required or league not found';
  end if;
end;
$$;

create or replace function public.read_public_overlay_snapshot(target_league_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public, extensions
as $$
  select jsonb_build_object(
    'league', jsonb_build_object(
      'id', l.id,
      'name', l.name,
      'slug', l.slug
    ),
    'matches', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', m.id,
        'legacyFirebaseId', null,
        'leagueId', m.league_id,
        'date', m.match_date,
        'teamA', m.team_a,
        'teamB', m.team_b,
        'scoreA', m.score_a,
        'scoreB', m.score_b,
        'roundLabel', m.round_label,
        'url', m.match_url,
        'logoA', m.logo_a,
        'logoB', m.logo_b
      ) order by m.match_date desc nulls last, m.created_at desc)
      from public.matches m
      where m.league_id = l.id
    ), '[]'::jsonb),
    'teams', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', t.id,
        'leagueId', t.league_id,
        'teamKey', t.team_key,
        'name', t.name,
        'logoUrl', t.logo_url,
        'cropMetadata', null
      ) order by t.name)
      from public.teams t
      where t.league_id = l.id
    ), '[]'::jsonb)
  )
  from public.leagues l
  where l.id = target_league_id
    and l.is_active
    and l.is_public;
$$;

revoke execute on function public.set_league_public_overlay(uuid, boolean) from public, anon;
revoke execute on function public.read_public_overlay_snapshot(uuid) from public, anon, authenticated;

grant execute on function public.set_league_public_overlay(uuid, boolean) to authenticated;
grant execute on function public.read_public_overlay_snapshot(uuid) to anon, authenticated;
