-- Authentication, permissions, trial and image quota migration.
-- Run after the existing leagues/teams/matches tables are available.

create extension if not exists pgcrypto;

alter table if exists public.leagues
  add column if not exists created_by text;

create table if not exists public.user_permissions (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  display_name text not null default '',
  photo_url text not null default '',
  status text not null default 'pending'
    check (status in ('allowed', 'denied', 'pending')),
  trial_started_at bigint,
  last_login timestamptz not null default now(),
  uploaded_image_count integer not null default 0
    check (uploaded_image_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_user_permissions_email_lower
  on public.user_permissions (lower(email));

alter table public.user_permissions enable row level security;

revoke all on table public.user_permissions from anon;
revoke insert, update, delete on table public.user_permissions from authenticated;
grant select on table public.user_permissions to authenticated;

create or replace function public.is_super_admin_email(p_email text)
returns boolean
language sql
immutable
security invoker
as $$
  select lower(trim(coalesce(p_email, ''))) = 'thanakrit_kas@hotmail.com';
$$;

drop policy if exists "Allow read user_permissions" on public.user_permissions;
drop policy if exists "Allow insert user_permissions" on public.user_permissions;
drop policy if exists "Allow update for super admin" on public.user_permissions;
drop policy if exists "Allow update profile for self" on public.user_permissions;
drop policy if exists "user_permissions_select_self_or_admin" on public.user_permissions;

create policy "user_permissions_select_self_or_admin"
on public.user_permissions
for select
to authenticated
using (
  public.is_super_admin_email(auth.jwt() ->> 'email')
  or lower(email) = lower(auth.jwt() ->> 'email')
);

-- Creates the first record for a logged-in user and records future logins.
-- The caller can only create/update the row belonging to its own JWT email.
create or replace function public.ensure_user_permission(
  p_email text,
  p_display_name text default '',
  p_photo_url text default ''
)
returns public.user_permissions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
  v_auth_email text := lower(trim(coalesce(auth.jwt() ->> 'email', '')));
  v_record public.user_permissions;
begin
  if auth.uid() is null or v_email = '' or v_email <> v_auth_email then
    raise exception 'not allowed';
  end if;

  insert into public.user_permissions (
    email, display_name, photo_url, status, trial_started_at, last_login, updated_at
  ) values (
    v_email,
    coalesce(p_display_name, ''),
    coalesce(p_photo_url, ''),
    case when public.is_super_admin_email(v_email) then 'allowed' else 'pending' end,
    case when public.is_super_admin_email(v_email)
      then null
      else (extract(epoch from clock_timestamp()) * 1000)::bigint
    end,
    now(),
    now()
  )
  on conflict (email) do update set
    display_name = case when excluded.display_name <> '' then excluded.display_name else public.user_permissions.display_name end,
    photo_url = case when excluded.photo_url <> '' then excluded.photo_url else public.user_permissions.photo_url end,
    trial_started_at = case
      when public.user_permissions.status = 'pending' and public.user_permissions.trial_started_at is null
        then (extract(epoch from clock_timestamp()) * 1000)::bigint
      else public.user_permissions.trial_started_at
    end,
    last_login = now(),
    updated_at = now();

  select * into v_record from public.user_permissions where email = v_email;
  return v_record;
end;
$$;

-- Admin-only list operation. It avoids exposing an all-row SELECT policy to normal users.
create or replace function public.admin_list_user_permissions()
returns setof public.user_permissions
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_super_admin_email(auth.jwt() ->> 'email') then
    raise exception 'admin access required';
  end if;
  return query
    select * from public.user_permissions order by created_at desc;
end;
$$;

-- Admin-only status management. A trial start is never reset for an existing user.
create or replace function public.admin_set_user_access_status(
  p_email text,
  p_status text
)
returns setof public.user_permissions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
begin
  if not public.is_super_admin_email(auth.jwt() ->> 'email') then
    raise exception 'admin access required';
  end if;
  if v_email = '' or p_status not in ('allowed', 'denied', 'pending') then
    raise exception 'invalid user status request';
  end if;
  if public.is_super_admin_email(v_email) then
    raise exception 'cannot change super admin status';
  end if;

  insert into public.user_permissions (email, status, trial_started_at, updated_at)
  values (
    v_email,
    p_status,
    case when p_status = 'pending' then (extract(epoch from clock_timestamp()) * 1000)::bigint else null end,
    now()
  )
  on conflict (email) do update set
    status = excluded.status,
    updated_at = now();

  return query
    select * from public.user_permissions order by created_at desc;
end;
$$;

-- Atomic, server-side quota increment for every authenticated upload channel.
create or replace function public.increment_uploaded_image_count()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(trim(coalesce(auth.jwt() ->> 'email', '')));
  v_record public.user_permissions;
  v_next integer;
  v_now_ms bigint := (extract(epoch from clock_timestamp()) * 1000)::bigint;
begin
  if auth.uid() is null or v_email = '' then
    raise exception 'authentication required';
  end if;

  select * into v_record
  from public.user_permissions
  where lower(email) = v_email
  for update;

  if not found then
    raise exception 'user permission record not found';
  end if;

  if not public.is_super_admin_email(v_email)
     and v_record.status <> 'allowed'
     and not (
       v_record.status = 'pending'
       and v_record.trial_started_at is not null
       and v_record.trial_started_at + (7 * 24 * 60 * 60 * 1000) > v_now_ms
     ) then
    raise exception 'upload access denied';
  end if;

  if not public.is_super_admin_email(v_email) and v_record.uploaded_image_count >= 10 then
    raise exception 'image upload quota exceeded';
  end if;

  update public.user_permissions
  set uploaded_image_count = uploaded_image_count + 1,
      updated_at = now()
  where id = v_record.id
  returning uploaded_image_count into v_next;

  return v_next;
end;
$$;

revoke all on function public.ensure_user_permission(text, text, text) from public;
revoke all on function public.admin_list_user_permissions() from public;
revoke all on function public.admin_set_user_access_status(text, text) from public;
revoke all on function public.increment_uploaded_image_count() from public;
grant execute on function public.ensure_user_permission(text, text, text) to authenticated;
grant execute on function public.admin_list_user_permissions() to authenticated;
grant execute on function public.admin_set_user_access_status(text, text) to authenticated;
grant execute on function public.increment_uploaded_image_count() to authenticated;

-- Legacy Firebase user_permissions import. Re-running this block is safe.
insert into public.user_permissions (
  email, display_name, photo_url, status, trial_started_at, last_login, uploaded_image_count
)
values
  (
    'thanakrit_kas@hotmail.com',
    'VAR Live Stream',
    'https://lh3.googleusercontent.com/a/ACg8ocJ6A9FbmjMneHdSagjbchd-AdzoUU7ATrhgtRtI-R84-Hs-1FYD=s96-c',
    'allowed',
    null,
    '2026-09-02T05:26:06.843Z'::timestamptz,
    3
  ),
  (
    'chomtanphetchaburi@gmail.com',
    'ธนกฤต กาสี',
    'https://lh3.googleusercontent.com/a/ACg8ocIzjej8w_XVicioZUNJuLts6n3ydXirwh8jV90virrLgTnOIuRN=s96-c',
    'allowed',
    1787562815672,
    '2026-09-02T05:29:39.360Z'::timestamptz,
    0
  ),
  (
    'kasthanakrit4@gmail.com',
    'Thanakrit kas',
    'https://lh3.googleusercontent.com/a/ACg8ocLmomFvaGmuLxwX9VDxKfyCPH2MSzso0SxHelHls-KFL5y6Ow=s96-c',
    'allowed',
    1787472458109,
    '2026-09-02T05:20:31.384Z'::timestamptz,
    0
  ),
  (
    'jeab.chomtan@gmail.com',
    'ชาญณรงค์ ลิ้มวารีรัตน์',
    'https://lh3.googleusercontent.com/a/ACg8ocJaE1mma7h-kM8KLxs50Xusmiv9nohhg_OGER-IzVvlcUJeSA=s96-c',
    'pending',
    1788183565902,
    '2026-09-02T05:29:40.157Z'::timestamptz,
    0
  ),
  (
    'nutshasucho@gmail.com',
    'Sucho Nutsha',
    'https://lh3.googleusercontent.com/a/ACg8ocJXrur8rq6FttyUlyMSpt8zI1V8BTqP57xExzezkwuROMtsAA=s96-c',
    'pending',
    1788326783279,
    '2026-09-02T05:26:23.815Z'::timestamptz,
    0
  )
on conflict (email) do update set
  display_name = excluded.display_name,
  photo_url = excluded.photo_url,
  status = excluded.status,
  trial_started_at = coalesce(public.user_permissions.trial_started_at, excluded.trial_started_at),
  last_login = excluded.last_login,
  uploaded_image_count = excluded.uploaded_image_count,
  updated_at = now();

-- Storage is public-read for OBS/browser-source URLs but write operations require login.
insert into storage.buckets (id, name, public)
values ('team-logos', 'team-logos', true)
on conflict (id) do update set public = true;

drop policy if exists "Public Access for team-logos" on storage.objects;
drop policy if exists "Allow Upload for team-logos" on storage.objects;
drop policy if exists "Allow Update for team-logos" on storage.objects;
drop policy if exists "Allow Delete for team-logos" on storage.objects;

create policy "Public read team-logos"
on storage.objects for select
to public
using (bucket_id = 'team-logos');

create policy "Authenticated upload team-logos"
on storage.objects for insert
to authenticated
with check (bucket_id = 'team-logos');

create policy "Authenticated update team-logos"
on storage.objects for update
to authenticated
using (bucket_id = 'team-logos')
with check (bucket_id = 'team-logos');

create policy "Authenticated delete team-logos"
on storage.objects for delete
to authenticated
using (bucket_id = 'team-logos');
