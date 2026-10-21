-- Apple Pay Shortcuts inbox. No bank credentials or card numbers are stored.
create table public.wallet_device_keys (
  user_id uuid primary key references auth.users(id) on delete cascade,
  token_hash text not null unique check (length(token_hash) = 64),
  created_at timestamptz not null default now()
);

create table public.wallet_merchant_rules (
  user_id uuid not null references auth.users(id) on delete cascade,
  merchant_key text not null,
  category_id uuid not null references public.categories(id) on delete cascade,
  subcategory_id uuid references public.subcategories(id) on delete set null,
  label text,
  auto_record boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (user_id, merchant_key),
  check (length(merchant_key) between 1 and 200)
);

create table public.wallet_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_event_id uuid not null,
  merchant text not null check (length(trim(merchant)) between 1 and 200),
  merchant_key text not null,
  amount_original numeric(15,2) not null check (amount_original > 0),
  original_currency text not null check (original_currency in ('GBP','EUR')),
  paid_at timestamptz not null,
  amount_eur numeric(15,2),
  fx_rate_date date,
  suggested_category_id uuid references public.categories(id) on delete set null,
  suggested_subcategory_id uuid references public.subcategories(id) on delete set null,
  status text not null default 'pending' check (status in ('pending','recorded','ignored')),
  transaction_id uuid unique references public.transactions(id) on delete set null,
  notes text,
  received_at timestamptz not null default now(),
  unique (user_id, source_event_id)
);
create index wallet_events_review_idx on public.wallet_events(user_id, status, paid_at desc);
create index wallet_events_duplicate_idx on public.wallet_events(user_id, merchant_key, amount_original, paid_at desc);

alter table public.wallet_device_keys enable row level security;
alter table public.wallet_merchant_rules enable row level security;
alter table public.wallet_events enable row level security;

-- Device credentials are NEVER directly visible through the browser Data API.
revoke all on public.wallet_device_keys from public, anon, authenticated;
grant all on public.wallet_device_keys to service_role;
grant select, insert, update, delete on public.wallet_events, public.wallet_merchant_rules to authenticated;
grant all on public.wallet_events, public.wallet_merchant_rules to service_role;

create policy "Owner reads Wallet events" on public.wallet_events for select
  to authenticated using (user_id = (select auth.uid()));
create policy "Owner edits Wallet events" on public.wallet_events for update
  to authenticated using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy "Owner reads merchant rules" on public.wallet_merchant_rules for select
  to authenticated using (user_id = (select auth.uid()));
create policy "Owner creates merchant rules" on public.wallet_merchant_rules for insert
  to authenticated with check (user_id = (select auth.uid()));
create policy "Owner updates merchant rules" on public.wallet_merchant_rules for update
  to authenticated using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy "Owner deletes merchant rules" on public.wallet_merchant_rules for delete
  to authenticated using (user_id = (select auth.uid()));

-- One-time display of a new cryptographic key; store only its SHA-256.
create function public.rotate_wallet_device_key() returns text
language plpgsql security definer set search_path = ''
as $$
declare v_user uuid := auth.uid(); v_token text;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  v_token := encode(gen_random_bytes(32), 'hex');
  insert into public.wallet_device_keys(user_id, token_hash, created_at)
  values (v_user, encode(sha256(convert_to(v_token,'UTF8')), 'hex'), now())
  on conflict (user_id) do update set token_hash=excluded.token_hash, created_at=now();
  return v_token;
end; $$;

create function public.revoke_wallet_device_key() returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  delete from public.wallet_device_keys where user_id = auth.uid();
end; $$;

-- Atomic, owner-authenticated transition from a Wallet event into a finance transaction.
create function public.record_wallet_event(
  p_event_id uuid, p_category_id uuid, p_subcategory_id uuid default null,
  p_description text default null, p_remember boolean default false
) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_user uuid := auth.uid(); v_event public.wallet_events%rowtype;
  v_category_scope text; v_account_id uuid; v_transaction_id uuid;
  v_description text;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  select * into v_event from public.wallet_events where id=p_event_id and user_id=v_user for update;
  if not found then raise exception 'Wallet event not found'; end if;
  if v_event.status='recorded' and v_event.transaction_id is not null then return v_event.transaction_id; end if;
  if v_event.status='ignored' then raise exception 'Ignored event'; end if;
  if v_event.amount_eur is null then raise exception 'Pending currency conversion'; end if;

  select category_scope into v_category_scope from public.categories
    where id=p_category_id and user_id=v_user and is_active;
  if v_category_scope is distinct from 'expense' then raise exception 'Invalid expense category'; end if;
  if p_subcategory_id is not null and not exists (
    select 1 from public.subcategories where id=p_subcategory_id
      and category_id=p_category_id and user_id=v_user and is_active
  ) then raise exception 'Invalid subcategory'; end if;

  select id into v_account_id from public.accounts
    where user_id=v_user order by is_default desc, name asc limit 1;
  if v_account_id is null then raise exception 'No account configured'; end if;

  v_description := coalesce(nullif(trim(p_description), ''), v_event.merchant);
  if length(v_description) > 200 then raise exception 'Description is too long'; end if;
  insert into public.transactions(
    user_id,account_id,transaction_date,name,amount,direction,
    category_id,subcategory_id,notes,source,source_external_id,import_metadata
  ) values (
    v_user, v_account_id, (v_event.paid_at at time zone 'Europe/London')::date,
    v_description, -v_event.amount_eur, 'expense',
    p_category_id,p_subcategory_id,
    concat('Apple Pay: ',v_event.amount_original,' ',v_event.original_currency,
      '; importe provisional, conciliar con Santander. ',
      coalesce(v_event.notes,'')), 'manual', 'wallet:'||v_event.source_event_id::text,
    jsonb_build_object('origin','apple_wallet','wallet_event_id',v_event.id,
      'amount_original',v_event.amount_original,'currency',v_event.original_currency,
      'fx_rate_date',v_event.fx_rate_date)
  ) returning id into v_transaction_id;

  update public.wallet_events set status='recorded',transaction_id=v_transaction_id,
    suggested_category_id=p_category_id,suggested_subcategory_id=p_subcategory_id
    where id=v_event.id;

  if p_remember then
    insert into public.wallet_merchant_rules(user_id,merchant_key,category_id,subcategory_id,label,auto_record)
    values(v_user,v_event.merchant_key,p_category_id,p_subcategory_id,v_description,true)
    on conflict (user_id,merchant_key) do update set category_id=excluded.category_id,
      subcategory_id=excluded.subcategory_id,label=excluded.label,auto_record=true,updated_at=now();
  end if;
  return v_transaction_id;
end; $$;

revoke all on function public.rotate_wallet_device_key() from public, anon;
revoke all on function public.revoke_wallet_device_key() from public, anon;
revoke all on function public.record_wallet_event(uuid,uuid,uuid,text,boolean) from public, anon;
grant execute on function public.rotate_wallet_device_key() to authenticated;
grant execute on function public.revoke_wallet_device_key() to authenticated;
grant execute on function public.record_wallet_event(uuid,uuid,uuid,text,boolean) to authenticated;
