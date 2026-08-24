-- Follow-up migration for projects that already ran 0001_initial_schema.sql.
-- Authenticated users update login activity through a controlled RPC because
-- user_access is intentionally not directly writable by regular users.

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

revoke execute on function public.record_user_login() from public, anon;
grant execute on function public.record_user_login() to authenticated;
