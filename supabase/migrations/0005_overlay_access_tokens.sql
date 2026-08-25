-- Owner-issued, read-only access tokens for OBS Browser Sources.
-- The token is stored only as a SHA-256 digest; the raw value is returned once
-- to the authenticated league owner who requested it.

create table if not exists public.overlay_access_tokens (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists overlay_access_tokens_lookup_idx
  on public.overlay_access_tokens (token_hash, expires_at);

alter table public.overlay_access_tokens enable row level security;

create or replace function public.create_overlay_access_token(
  target_league_id uuid,
  ttl_seconds integer default 604800
)
returns table (access_token text, expires_at timestamptz)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  raw_token text;
  token_expiry timestamptz;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if ttl_seconds < 300 or ttl_seconds > 2592000 then
    raise exception 'Token lifetime must be between 5 minutes and 30 days';
  end if;

  if not exists (
    select 1
    from public.leagues
    where id = target_league_id
      and is_active
      and (owner_id = auth.uid() or public.has_role('super_admin'))
  ) then
    raise exception 'League owner permission required';
  end if;

  raw_token := encode(gen_random_bytes(32), 'hex');
  token_expiry := timezone('utc', now()) + make_interval(secs => ttl_seconds);

  insert into public.overlay_access_tokens (league_id, created_by, token_hash, expires_at)
  values (
    target_league_id,
    auth.uid(),
    encode(digest(raw_token, 'sha256'), 'hex'),
    token_expiry
  );

  return query select raw_token, token_expiry;
end;
$$;

create or replace function public.read_overlay_snapshot(request_token text)
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
        'legacyFirebaseId', m.legacy_firebase_id,
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
        'cropMetadata', t.crop_metadata
      ) order by t.name)
      from public.teams t
      where t.league_id = l.id
    ), '[]'::jsonb)
  )
  from public.overlay_access_tokens oat
  join public.leagues l on l.id = oat.league_id and l.is_active
  where oat.token_hash = encode(digest(trim(request_token), 'sha256'), 'hex')
    and oat.expires_at > timezone('utc', now())
  limit 1;
$$;

create or replace function public.revoke_overlay_access_tokens(target_league_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not exists (
    select 1
    from public.leagues
    where id = target_league_id
      and (owner_id = auth.uid() or public.has_role('super_admin'))
  ) then
    raise exception 'League owner permission required';
  end if;

  delete from public.overlay_access_tokens where league_id = target_league_id;
end;
$$;

revoke all on table public.overlay_access_tokens from anon, authenticated;
revoke execute on function public.create_overlay_access_token(uuid, integer) from public, anon;
revoke execute on function public.read_overlay_snapshot(text) from public, anon, authenticated;
revoke execute on function public.revoke_overlay_access_tokens(uuid) from public, anon;

grant execute on function public.create_overlay_access_token(uuid, integer) to authenticated;
grant execute on function public.read_overlay_snapshot(text) to anon, authenticated;
grant execute on function public.revoke_overlay_access_tokens(uuid) to authenticated;
