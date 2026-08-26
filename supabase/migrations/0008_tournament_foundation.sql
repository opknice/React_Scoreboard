-- Tournament Management foundation.
--
-- This migration is intentionally additive. It preserves the current
-- Scoreboard/Overlay/Database Viewer contract by keeping all legacy match
-- columns and by adding new match relationships as nullable.
--
-- Preconditions before running against a real project:
--   1. Verify migrations 0001 through 0007 are applied.
--   2. Take a database snapshot and export legacy match/team counts.
--   3. Verify no existing rows violate the proposed constraints.
--   4. Run in staging before production.

begin;

-- ---------------------------------------------------------------------------
-- Tournament metadata on the existing League container.
-- ---------------------------------------------------------------------------

alter table public.leagues
  add column if not exists season text,
  add column if not exists description text,
  add column if not exists logo_url text,
  add column if not exists start_date date,
  add column if not exists end_date date,
  add column if not exists timezone text,
  add column if not exists status text,
  add column if not exists format_type text,
  add column if not exists format_settings jsonb;

update public.leagues
set logo_url = ''
where logo_url is null;

update public.leagues
set timezone = 'Asia/Bangkok'
where timezone is null or btrim(timezone) = '';

update public.leagues
set status = 'draft'
where status is null or btrim(status) = '';

update public.leagues
set format_type = 'custom'
where format_type is null or btrim(format_type) = '';

update public.leagues
set format_settings = case
  when jsonb_typeof(format_settings) = 'object'
    then format_settings || jsonb_build_object('version', 1)
  else jsonb_build_object('version', 1)
end
where format_settings is null
   or jsonb_typeof(format_settings) <> 'object'
   or not (format_settings ? 'version');

alter table public.leagues
  alter column logo_url set default '',
  alter column logo_url set not null,
  alter column timezone set default 'Asia/Bangkok',
  alter column timezone set not null,
  alter column status set default 'draft',
  alter column status set not null,
  alter column format_type set default 'custom',
  alter column format_type set not null,
  alter column format_settings set default jsonb_build_object('version', 1),
  alter column format_settings set not null;

alter table public.leagues
  add constraint leagues_tournament_dates_check
    check (start_date is null or end_date is null or end_date >= start_date),
  add constraint leagues_tournament_status_check
    check (status in ('draft', 'upcoming', 'live', 'finished', 'archived')),
  add constraint leagues_format_type_check
    check (format_type in ('round_robin', 'knockout', 'group_stage', 'custom')),
  add constraint leagues_format_settings_object_check
    check (
      jsonb_typeof(format_settings) = 'object'
      and format_settings ? 'version'
      and jsonb_typeof(format_settings -> 'version') = 'number'
      and (format_settings ->> 'version') ~ '^[0-9]+$'
    ),
  add constraint leagues_timezone_nonempty_check
    check (btrim(timezone) <> '');

-- ---------------------------------------------------------------------------
-- Matchweek and Venue tables.
-- ---------------------------------------------------------------------------

create table public.matchweeks (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete restrict,
  number integer not null,
  label text not null default '',
  scheduled_date date,
  status text not null default 'draft',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint matchweeks_number_positive_check check (number > 0),
  constraint matchweeks_status_check
    check (status in ('draft', 'scheduled', 'locked', 'completed', 'archived')),
  constraint matchweeks_league_number_unique unique (league_id, number),
  constraint matchweeks_league_id_unique unique (league_id, id)
);

create table public.venues (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete restrict,
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint venues_league_id_unique unique (league_id, id),
  constraint venues_name_nonempty_check check (btrim(name) <> '')
);

create unique index if not exists venues_league_normalized_name_unique_idx
  on public.venues (league_id, lower(btrim(name)));

-- The existing teams table uses a UUID primary key. This additional unique key
-- is required for composite foreign keys that also enforce league ownership.
alter table public.teams
  add constraint teams_league_id_unique unique (league_id, id);

-- ---------------------------------------------------------------------------
-- Additive Match relationships and lifecycle fields.
-- ---------------------------------------------------------------------------

alter table public.matches
  add column if not exists matchweek_id uuid,
  add column if not exists team_a_id uuid,
  add column if not exists team_b_id uuid,
  add column if not exists scheduled_at timestamptz,
  add column if not exists venue_id uuid,
  add column if not exists status text,
  add column if not exists reschedule_reason text;

update public.matches
set status = 'tbd'
where status is null or btrim(status) = '';

alter table public.matches
  alter column status set default 'tbd',
  alter column status set not null;

alter table public.matches
  add constraint matches_status_check
    check (status in ('tbd', 'scheduled', 'live', 'half_time', 'finished', 'postponed', 'cancelled')),
  add constraint matches_distinct_teams_check
    check (
      team_a_id is null
      or team_b_id is null
      or team_a_id <> team_b_id
    ),
  add constraint matches_reschedule_reason_nonempty_check
    check (reschedule_reason is null or btrim(reschedule_reason) <> ''),
  add constraint matches_matchweek_league_fk
    foreign key (league_id, matchweek_id)
    references public.matchweeks (league_id, id),
  add constraint matches_team_a_league_fk
    foreign key (league_id, team_a_id)
    references public.teams (league_id, id),
  add constraint matches_team_b_league_fk
    foreign key (league_id, team_b_id)
    references public.teams (league_id, id),
  add constraint matches_venue_league_fk
    foreign key (league_id, venue_id)
    references public.venues (league_id, id);

-- ---------------------------------------------------------------------------
-- Indexes for Tournament/Fixture queries.
-- ---------------------------------------------------------------------------

create index if not exists matchweeks_league_date_idx
  on public.matchweeks (league_id, scheduled_date, number);

create index if not exists matches_league_matchweek_schedule_idx
  on public.matches (league_id, matchweek_id, scheduled_at);

create index if not exists matches_league_status_schedule_idx
  on public.matches (league_id, status, scheduled_at);

create index if not exists matches_league_team_a_idx
  on public.matches (league_id, team_a_id);

create index if not exists matches_league_team_b_idx
  on public.matches (league_id, team_b_id);

create index if not exists matches_league_venue_idx
  on public.matches (league_id, venue_id);

create index if not exists venues_league_active_name_idx
  on public.venues (league_id, is_active, name);

-- ---------------------------------------------------------------------------
-- Reuse the existing updated_at trigger function for new tables.
-- ---------------------------------------------------------------------------

create trigger matchweeks_set_updated_at
before update on public.matchweeks
for each row execute function public.set_updated_at();

create trigger venues_set_updated_at
before update on public.venues
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Defensive integrity triggers.
-- ---------------------------------------------------------------------------

create or replace function public.prevent_league_reassignment()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.league_id is distinct from old.league_id then
    raise exception 'league_id is immutable after row creation';
  end if;

  return new;
end;
$$;

create or replace function public.prevent_locked_matchweek_reorder()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.number is distinct from old.number
     and old.status in ('locked', 'completed', 'archived') then
    raise exception 'Cannot reorder a locked, completed, or archived matchweek';
  end if;

  return new;
end;
$$;

create or replace function public.prevent_referenced_team_delete()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if exists (
    select 1
    from public.matches
    where matches.league_id = old.league_id
      and (
        matches.team_a_id = old.id
        or matches.team_b_id = old.id
        or lower(btrim(matches.team_a)) = lower(btrim(old.name))
        or lower(btrim(matches.team_b)) = lower(btrim(old.name))
      )
  ) then
    raise exception 'Cannot delete a team referenced by a match';
  end if;

  return old;
end;
$$;

create trigger teams_prevent_league_reassignment
before update on public.teams
for each row execute function public.prevent_league_reassignment();

create trigger matches_prevent_league_reassignment
before update on public.matches
for each row execute function public.prevent_league_reassignment();

create trigger matchweeks_prevent_league_reassignment
before update on public.matchweeks
for each row execute function public.prevent_league_reassignment();

create trigger venues_prevent_league_reassignment
before update on public.venues
for each row execute function public.prevent_league_reassignment();

create trigger matchweeks_prevent_locked_reorder
before update on public.matchweeks
for each row execute function public.prevent_locked_matchweek_reorder();

create trigger teams_prevent_referenced_delete
before delete on public.teams
for each row execute function public.prevent_referenced_team_delete();

-- ---------------------------------------------------------------------------
-- RLS for new tables. No DELETE policy is intentional: archive instead.
-- The existing has_league_role() helper implements owner/Super Admin access
-- after 0003_private_league_ownership.sql.
-- ---------------------------------------------------------------------------

alter table public.matchweeks enable row level security;
alter table public.venues enable row level security;

create policy matchweeks_owner_or_admin_select
on public.matchweeks for select
using (public.has_league_role(league_id, 'operator'));

create policy matchweeks_owner_or_admin_insert
on public.matchweeks for insert
with check (public.has_league_role(league_id, 'operator'));

create policy matchweeks_owner_or_admin_update
on public.matchweeks for update
using (public.has_league_role(league_id, 'operator'))
with check (public.has_league_role(league_id, 'operator'));

create policy venues_owner_or_admin_select
on public.venues for select
using (public.has_league_role(league_id, 'operator'));

create policy venues_owner_or_admin_insert
on public.venues for insert
with check (public.has_league_role(league_id, 'operator'));

create policy venues_owner_or_admin_update
on public.venues for update
using (public.has_league_role(league_id, 'operator'))
with check (public.has_league_role(league_id, 'operator'));

revoke all on table public.matchweeks, public.venues from anon;
grant select, insert, update on table public.matchweeks, public.venues to authenticated;

-- ---------------------------------------------------------------------------
-- Realtime publication for future Tournament/Fixture clients.
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'matchweeks'
  ) then
    execute 'alter publication supabase_realtime add table public.matchweeks';
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'venues'
  ) then
    execute 'alter publication supabase_realtime add table public.venues';
  end if;
end;
$$;

commit;
