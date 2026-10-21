-- Per-event, short-lived capability to let Instinct record ONLY a Wallet expense.
-- The agent never gets Supabase credentials, Santander access or access to the ledger.
create table public.wallet_agent_links (
  wallet_event_id uuid primary key references public.wallet_events(id) on delete cascade,
  token_hash text not null unique check (length(token_hash)=64),
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);
create index wallet_agent_links_expiry_idx on public.wallet_agent_links(expires_at);
alter table public.wallet_agent_links enable row level security;
revoke all on public.wallet_agent_links from public, anon, authenticated;
grant all on public.wallet_agent_links to service_role;

-- Only invoked from the trusted Edge Function after the per-event token is validated.
-- This function revalidates and atomically spends the token + writes the expense.
create function public.record_wallet_event_from_agent(
  p_token text,
  p_category_id uuid,
  p_subcategory_id uuid default null,
  p_description text default null,
  p_remember boolean default false
) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_hash text;
  v_link public.wallet_agent_links%rowtype;
  v_event public.wallet_events%rowtype;
  v_account_id uuid;
  v_description text;
  v_tx uuid;
begin
  if length(p_token) <> 64 or p_token !~ '^[0-9a-f]+$' then
    raise exception 'Invalid agent link';
  end if;
  v_hash := encode(sha256(convert_to(p_token,'UTF8')),'hex');
  select * into v_link from public.wallet_agent_links
    where token_hash=v_hash for update;
  if not found or v_link.expires_at <= now() or v_link.used_at is not null then
    raise exception 'Expired or already used agent link';
  end if;
  select * into v_event from public.wallet_events
    where id=v_link.wallet_event_id for update;
  if not found or v_event.status <> 'pending' then
    raise exception 'Wallet payment already handled';
  end if;
  if v_event.amount_eur is null or v_event.amount_eur <= 0 then
    raise exception 'Currency conversion not yet available';
  end if;
  if not exists (select 1 from public.categories where id=p_category_id
    and user_id=v_event.user_id and category_scope='expense' and is_active)
  then raise exception 'Invalid expense category'; end if;
  if p_subcategory_id is not null and not exists (
    select 1 from public.subcategories where id=p_subcategory_id
    and category_id=p_category_id and user_id=v_event.user_id and is_active
  ) then raise exception 'Invalid expense subcategory'; end if;

  select id into v_account_id from public.accounts
    where user_id=v_event.user_id order by is_default desc, name limit 1;
  if v_account_id is null then raise exception 'No account configured'; end if;
  v_description:=coalesce(nullif(trim(p_description),''),v_event.merchant);
  if length(v_description) > 200 then raise exception 'Description is too long'; end if;

  insert into public.transactions(
    user_id,account_id,transaction_date,name,amount,direction,
    category_id,subcategory_id,notes,source,source_external_id,import_metadata
  ) values(
    v_event.user_id,v_account_id,(v_event.paid_at at time zone 'Europe/London')::date,
    v_description,-v_event.amount_eur,'expense',p_category_id,p_subcategory_id,
    concat('Apple Pay: ',v_event.amount_original,' ',v_event.original_currency,
    '; provisional, reconcile with Santander. ',coalesce(v_event.notes,'')),
    'manual','wallet:'||v_event.source_event_id::text,
    jsonb_build_object('origin','apple_wallet','wallet_event_id',v_event.id,
    'amount_original',v_event.amount_original,'currency',v_event.original_currency,
    'fx_rate_date',v_event.fx_rate_date,'recorded_by','instinct')
  ) returning id into v_tx;

  update public.wallet_events set status='recorded',transaction_id=v_tx,
    suggested_category_id=p_category_id,suggested_subcategory_id=p_subcategory_id
    where id=v_event.id;
  update public.wallet_agent_links set used_at=now() where wallet_event_id=v_event.id;
  if p_remember then
    insert into public.wallet_merchant_rules(user_id,merchant_key,category_id,
      subcategory_id,label,auto_record)
    values(v_event.user_id,v_event.merchant_key,p_category_id,p_subcategory_id,
      v_description,true)
    on conflict(user_id,merchant_key) do update
      set category_id=excluded.category_id,subcategory_id=excluded.subcategory_id,
      label=excluded.label,auto_record=true,updated_at=now();
  end if;
  return v_tx;
end; $$;
revoke all on function public.record_wallet_event_from_agent(text,uuid,uuid,text,boolean) from public, anon, authenticated;
grant execute on function public.record_wallet_event_from_agent(text,uuid,uuid,text,boolean) to service_role;
