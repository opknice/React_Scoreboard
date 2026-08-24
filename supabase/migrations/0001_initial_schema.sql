-- OBS Football Scoreboard - Supabase foundation schema
-- This migration is intentionally additive. Firebase remains the active provider
-- until the application adapters and data migration have been verified.

create extension if not exists pgcrypto;

create table public.leagues (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  is_public boolean not null default true,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  display_name text not null default '',
  photo_url text not null default '',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.user_access (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('allowed', 'pending', 'denied')),
  trial_started_at timestamptz,
  last_login_at timestamptz,
  uploaded_image_count integer not null default 0 check (uploaded_image_count >= 0),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.user_roles (
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (role in ('super_admin', 'operator', 'viewer')),
  created_at timestamptz not null default timezone('utc', now()),
  primary key (user_id, role)
);

create table public.league_memberships (
  user_id uuid not null references public.profiles(id) on delete cascade,
  league_id uuid not null references public.leagues(id) on delete cascade,
  role text not null default 'viewer' check (role in ('operator', 'viewer')),
  created_at timestamptz not null default timezone('utc', now()),
  primary key (user_id, league_id)
);

create table public.teams (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  team_key text not null,
  name text not null,
  logo_url text not null default '',
  crop_metadata jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (league_id, team_key)
);

create table public.matches (
  id uuid primary key default gen_random_uuid(),
  legacy_firebase_id text,
  league_id uuid not null references public.leagues(id) on delete cascade,
  match_date date,
  team_a text not null default '',
  team_b text not null default '',
  score_a integer not null default 0 check (score_a >= 0),
  score_b integer not null default 0 check (score_b >= 0),
  round_label text not null default '',
  match_url text not null default '',
  logo_a text not null default '',
  logo_b text not null default '',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index matches_league_date_idx
  on public.matches (league_id, match_date desc);

create index matches_league_round_idx
  on public.matches (league_id, round_label);

create index teams_league_name_idx
  on public.teams (league_id, name);

create index league_memberships_user_idx
  on public.league_memberships (user_id, league_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create trigger leagues_set_updated_at
before update on public.leagues
for each row execute function public.set_updated_at();

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger user_access_set_updated_at
before update on public.user_access
for each row execute function public.set_updated_at();

create trigger teams_set_updated_at
before update on public.teams
for each row execute function public.set_updated_at();

create trigger matches_set_updated_at
before update on public.matches
for each row execute function public.set_updated_at();

create or replace function public.has_role(required_role text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles
    where user_id = auth.uid()
      and role = required_role
  );
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
      from public.league_memberships
      where user_id = auth.uid()
        and league_id = target_league_id
        and role = required_role
    );
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name, photo_url)
  values (
    new.id,
    lower(coalesce(new.email, '')),
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(new.raw_user_meta_data ->> 'avatar_url', '')
  )
  on conflict (id) do update set
    email = excluded.email,
    display_name = excluded.display_name,
    photo_url = excluded.photo_url;

  insert into public.user_access (user_id, status, trial_started_at)
  values (new.id, 'pending', timezone('utc', now()))
  on conflict (user_id) do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.record_user_login()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  update public.user_access
  set last_login_at = timezone('utc', now())
  where user_id = auth.uid();

  if not found then
    raise exception 'User access record not found';
  end if;
end;
$$;

create or replace function public.increment_image_upload_count(amount integer default 1)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  next_count integer;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if amount <= 0 then
    raise exception 'Amount must be positive';
  end if;

  update public.user_access
  set uploaded_image_count = uploaded_image_count + amount
  where user_id = auth.uid()
  returning uploaded_image_count into next_count;

  if next_count is null then
    raise exception 'User access record not found';
  end if;

  return next_count;
end;
$$;

create or replace function public.admin_set_user_access(
  target_user_id uuid,
  next_status text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.has_role('super_admin') then
    raise exception 'Super Admin role required';
  end if;

  if next_status not in ('allowed', 'pending', 'denied') then
    raise exception 'Invalid access status';
  end if;

  update public.user_access
  set status = next_status
  where user_id = target_user_id;

  if not found then
    raise exception 'Target user access record not found';
  end if;
end;
$$;

alter table public.leagues enable row level security;
alter table public.profiles enable row level security;
alter table public.user_access enable row level security;
alter table public.user_roles enable row level security;
alter table public.league_memberships enable row level security;
alter table public.teams enable row level security;
alter table public.matches enable row level security;

create policy leagues_select_public_or_member
on public.leagues for select
using (
  is_active
  and (
    is_public
    or public.has_role('super_admin')
    or exists (
      select 1 from public.league_memberships
      where league_id = leagues.id and user_id = auth.uid()
    )
  )
);

create policy leagues_admin_write
on public.leagues for all
using (public.has_role('super_admin'))
with check (public.has_role('super_admin'));

create policy profiles_select_self_or_admin
on public.profiles for select
using (id = auth.uid() or public.has_role('super_admin'));

create policy profiles_update_self_or_admin
on public.profiles for update
using (id = auth.uid() or public.has_role('super_admin'))
with check (id = auth.uid() or public.has_role('super_admin'));

create policy user_access_select_self_or_admin
on public.user_access for select
using (user_id = auth.uid() or public.has_role('super_admin'));

create policy user_access_admin_write
on public.user_access for all
using (public.has_role('super_admin'))
with check (public.has_role('super_admin'));

create policy user_roles_select_self_or_admin
on public.user_roles for select
using (user_id = auth.uid() or public.has_role('super_admin'));

create policy user_roles_admin_write
on public.user_roles for all
using (public.has_role('super_admin'))
with check (public.has_role('super_admin'));

create policy league_memberships_select_self_or_admin
on public.league_memberships for select
using (user_id = auth.uid() or public.has_role('super_admin'));

create policy league_memberships_admin_write
on public.league_memberships for all
using (public.has_role('super_admin'))
with check (public.has_role('super_admin'));

create policy teams_select_public_or_member
on public.teams for select
using (
  exists (
    select 1 from public.leagues
    where leagues.id = teams.league_id
      and leagues.is_active
      and (
        leagues.is_public
        or public.has_role('super_admin')
        or exists (
          select 1 from public.league_memberships
          where league_id = teams.league_id and user_id = auth.uid()
        )
      )
  )
);

create policy teams_operator_write
on public.teams for all
using (public.has_league_role(league_id, 'operator'))
with check (public.has_league_role(league_id, 'operator'));

create policy matches_select_public_or_member
on public.matches for select
using (
  exists (
    select 1 from public.leagues
    where leagues.id = matches.league_id
      and leagues.is_active
      and (
        leagues.is_public
        or public.has_role('super_admin')
        or exists (
          select 1 from public.league_memberships
          where league_id = matches.league_id and user_id = auth.uid()
        )
      )
  )
);

create policy matches_operator_write
on public.matches for all
using (public.has_league_role(league_id, 'operator'))
with check (public.has_league_role(league_id, 'operator'));

grant usage on schema public to anon, authenticated;
grant select on public.leagues, public.teams, public.matches to anon, authenticated;
grant select on public.profiles, public.user_access, public.user_roles, public.league_memberships to authenticated;
revoke execute on function public.has_role(text) from public, anon, authenticated;
revoke execute on function public.has_league_role(uuid, text) from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.record_user_login() from public, anon;
revoke execute on function public.increment_image_upload_count(integer) from public, anon;
revoke execute on function public.admin_set_user_access(uuid, text) from public, anon;
grant execute on function public.has_role(text) to authenticated;
grant execute on function public.has_league_role(uuid, text) to authenticated;
grant execute on function public.record_user_login() to authenticated;
grant execute on function public.increment_image_upload_count(integer) to authenticated;
grant execute on function public.admin_set_user_access(uuid, text) to authenticated;

-- Enable row-level realtime events for the initial migration.
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'matches'
  ) then
    alter publication supabase_realtime add table public.matches;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'teams'
  ) then
    alter publication supabase_realtime add table public.teams;
  end if;
end;
$$;
