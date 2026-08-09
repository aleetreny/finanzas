-- Serialize first-account creation so a freshly cloned project cannot admit
-- two owners through concurrent Auth requests.
create or replace function private.reject_additional_auth_users()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(hashtext('finanzas:owner-account')::bigint);

  if exists (select 1 from auth.users) then
    raise exception using
      errcode = '42501',
      message = 'This project only permits its existing owner account.';
  end if;
  return new;
end;
$$;

revoke all on function private.reject_additional_auth_users() from public, anon, authenticated;
