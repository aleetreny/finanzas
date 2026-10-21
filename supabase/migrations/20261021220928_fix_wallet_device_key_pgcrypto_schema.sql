-- pgcrypto is installed under extensions in this Supabase project.
-- Keep search_path locked down on SECURITY DEFINER, qualify just the required function.
create or replace function public.rotate_wallet_device_key() returns text
language plpgsql security definer set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_token text;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  v_token := encode(extensions.gen_random_bytes(32), 'hex');
  insert into public.wallet_device_keys(user_id, token_hash, created_at)
  values (v_user, encode(sha256(convert_to(v_token,'UTF8')), 'hex'), now())
  on conflict (user_id) do update set
    token_hash=excluded.token_hash,
    created_at=now();
  return v_token;
end;
$$;
revoke all on function public.rotate_wallet_device_key() from public, anon;
grant execute on function public.rotate_wallet_device_key() to authenticated;
