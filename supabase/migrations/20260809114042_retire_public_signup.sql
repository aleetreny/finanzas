-- Retire the public invitation path without touching the owner's financial
-- data or the existing technical audit row kept in signup_rate_limits.
drop function if exists public.consume_signup_attempt(text);

-- No deployed code should access this legacy table after the retirement.
revoke all on table public.signup_rate_limits from service_role;
comment on table public.signup_rate_limits is
  'Legacy invitation rate-limit records retained without active access.';

-- Defense in depth for hosted projects: after the first manually created
-- owner exists, Auth itself cannot insert any additional accounts. A fresh
-- cloned deployment starts with no users, so its first owner is still allowed.
create or replace function private.reject_additional_auth_users()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from auth.users) then
    raise exception using
      errcode = '42501',
      message = 'This project only permits its existing owner account.';
  end if;
  return new;
end;
$$;

revoke all on function private.reject_additional_auth_users() from public, anon, authenticated;

drop trigger if exists restrict_auth_user_creation on auth.users;
create trigger restrict_auth_user_creation
  before insert on auth.users
  for each row execute function private.reject_additional_auth_users();
