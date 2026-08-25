-- Realtime permission events for the signed-in user's access and roles.
-- RLS policies still control which rows a user can read.

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'user_access'
  ) then
    alter publication supabase_realtime add table public.user_access;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'user_roles'
  ) then
    alter publication supabase_realtime add table public.user_roles;
  end if;
end;
$$;
