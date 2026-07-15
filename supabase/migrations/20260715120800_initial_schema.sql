-- Finanzas: initial schema, security policies and first-user bootstrap.
-- Every public table is protected by RLS. The imported dataset starts unclaimed
-- (user_id = null) and is atomically assigned to the first authenticated user.

create extension if not exists pgcrypto;
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create type public.transaction_direction as enum ('income', 'expense', 'neutral');
create type public.transaction_source as enum ('manual', 'csv_import', 'recurring', 'rental_calculator');
create type public.booking_platform as enum ('airbnb', 'booking', 'direct', 'other');
create type public.calculation_status as enum ('draft', 'reconciled', 'needs_review');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  type text not null default 'bank' check (type in ('bank', 'cash', 'savings', 'credit', 'other')),
  currency text not null default 'EUR' check (currency ~ '^[A-Z]{3}$'),
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index accounts_one_default_per_user
  on public.accounts(user_id) where is_default and user_id is not null;
create unique index accounts_name_per_user
  on public.accounts(user_id, lower(name)) where user_id is not null;

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index categories_name_per_user
  on public.categories(user_id, lower(name)) where user_id is not null;

create table public.subcategories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  category_id uuid not null references public.categories(id) on delete cascade,
  name text not null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index subcategories_name_per_category
  on public.subcategories(category_id, lower(name));

create table public.trip_projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  start_date date,
  end_date date,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date is null or start_date is null or end_date >= start_date)
);

create unique index trip_projects_name_per_user
  on public.trip_projects(user_id, lower(name)) where user_id is not null;

create table public.properties (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  property_type text not null default 'rental',
  is_active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index properties_name_per_user
  on public.properties(user_id, lower(name)) where user_id is not null;

create table public.recurring_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  amount numeric(14,2) not null,
  frequency text not null check (frequency in ('weekly', 'monthly', 'quarterly', 'yearly')),
  day_of_month smallint check (day_of_month between 1 and 31),
  effective_from date not null,
  effective_until date,
  category_id uuid references public.categories(id) on delete set null,
  subcategory_id uuid references public.subcategories(id) on delete set null,
  context text,
  auto_generate boolean not null default false,
  is_active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (effective_until is null or effective_until >= effective_from)
);

create table public.import_batches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  file_name text not null,
  file_hash text not null,
  total_rows integer not null check (total_rows >= 0),
  imported_rows integer not null default 0 check (imported_rows >= 0),
  rejected_rows integer not null default 0 check (rejected_rows >= 0),
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  check (imported_rows + rejected_rows <= total_rows)
);

create unique index import_batches_hash_per_user
  on public.import_batches(user_id, file_hash) where user_id is not null;

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  account_id uuid not null references public.accounts(id) on delete restrict,
  transaction_date date not null,
  name text not null check (length(trim(name)) > 0),
  amount numeric(14,2) not null,
  direction public.transaction_direction not null,
  category_id uuid references public.categories(id) on delete set null,
  subcategory_id uuid references public.subcategories(id) on delete set null,
  context text,
  platform text,
  trip_project_id uuid references public.trip_projects(id) on delete set null,
  recurring_rule_id uuid references public.recurring_rules(id) on delete set null,
  fiscal_property_status text,
  notes text,
  source public.transaction_source not null default 'manual',
  source_external_id text,
  import_batch_id uuid references public.import_batches(id) on delete set null,
  import_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (direction = 'income' and amount >= 0)
    or (direction = 'expense' and amount <= 0)
    or (direction = 'neutral' and amount = 0)
  )
);

create unique index transactions_external_id_per_user
  on public.transactions(user_id, source, source_external_id);
create index transactions_user_date_idx on public.transactions(user_id, transaction_date desc);
create index transactions_user_category_idx on public.transactions(user_id, category_id);
create index transactions_user_context_idx on public.transactions(user_id, context);

create table public.rental_bookings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete restrict,
  platform public.booking_platform not null,
  booking_date date,
  check_in_date date,
  check_out_date date,
  discount_amount numeric(14,2) not null default 0,
  cleaning_fee numeric(14,2) not null default 0,
  guest_paid_after_discount numeric(14,2) not null default 0,
  gross_before_discount numeric(14,2) not null default 0,
  platform_commission_rate numeric(8,6) not null default 0,
  platform_commission_amount numeric(14,2) not null default 0,
  bank_fee_rate numeric(8,6) not null default 0,
  bank_fee_amount numeric(14,2) not null default 0,
  manager_rate numeric(8,6) not null default 0,
  manager_commission_amount numeric(14,2) not null default 0,
  manager_cleaning_amount numeric(14,2) not null default 0,
  payout_received numeric(14,2) not null default 0,
  amount_payable_to_manager numeric(14,2) not null default 0,
  owner_net_after_manager numeric(14,2) not null default 0,
  calculation_status public.calculation_status not null default 'draft',
  manual_override boolean not null default false,
  linked_transaction_id uuid references public.transactions(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (check_out_date is null or check_in_date is null or check_out_date >= check_in_date)
);

create table public.assets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  property_id uuid references public.properties(id) on delete set null,
  linked_transaction_id uuid references public.transactions(id) on delete set null,
  name text not null,
  asset_type text not null,
  acquisition_date date not null,
  cost numeric(14,2) not null check (cost >= 0),
  amortization_method text not null default 'straight_line' check (amortization_method = 'straight_line'),
  annual_rate numeric(8,6) not null check (annual_rate >= 0 and annual_rate <= 1),
  useful_life_years numeric(8,2) check (useful_life_years is null or useful_life_years > 0),
  residual_value numeric(14,2) not null default 0 check (residual_value >= 0),
  business_use_percentage numeric(8,6) not null default 1 check (business_use_percentage between 0 and 1),
  start_date date not null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (residual_value <= cost)
);

create table public.asset_depreciation_entries (
  asset_id uuid not null references public.assets(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  fiscal_year integer not null check (fiscal_year between 1900 and 2200),
  opening_basis numeric(14,2) not null,
  annual_depreciation numeric(14,2) not null,
  accumulated_depreciation numeric(14,2) not null,
  pending_value numeric(14,2) not null,
  created_at timestamptz not null default now(),
  primary key (asset_id, fiscal_year)
);

create table public.app_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  airbnb_cleaning_fee numeric(14,2) not null default 60,
  airbnb_platform_rate numeric(8,6) not null default 0.18755,
  booking_cleaning_fee numeric(14,2) not null default 70,
  booking_platform_rate numeric(8,6) not null default 0.15,
  booking_bank_rate numeric(8,6) not null default 0.013,
  manager_rate numeric(8,6) not null default 0.18,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.dataset_claims (
  dataset_key text primary key,
  claimed_by uuid references auth.users(id) on delete set null,
  claimed_at timestamptz,
  created_at timestamptz not null default now()
);

insert into public.dataset_claims(dataset_key) values ('initial-v1');

create function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'profiles', 'accounts', 'categories', 'subcategories', 'trip_projects',
    'properties', 'recurring_rules', 'transactions', 'rental_bookings',
    'assets', 'app_settings'
  ] loop
    execute format(
      'create trigger set_updated_at before update on public.%I for each row execute function private.set_updated_at()',
      table_name
    );
  end loop;
end;
$$;

create function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles(id, email, display_name)
  values (new.id, coalesce(new.email, ''), coalesce(new.raw_user_meta_data ->> 'display_name', split_part(coalesce(new.email, ''), '@', 1)))
  on conflict (id) do update set email = excluded.email;
  insert into public.app_settings(user_id) values (new.id) on conflict (user_id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert or update of email on auth.users
  for each row execute function private.handle_new_user();

create function public.claim_initial_dataset()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  existing_owner uuid;
  claimed_count integer;
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  update public.dataset_claims
  set claimed_by = current_user_id, claimed_at = now()
  where dataset_key = 'initial-v1' and claimed_by is null;

  select claimed_by into existing_owner
  from public.dataset_claims where dataset_key = 'initial-v1';

  if existing_owner is distinct from current_user_id then
    raise exception 'The initial dataset is already assigned';
  end if;

  insert into public.profiles(id, email, display_name)
  select id, coalesce(email, ''), split_part(coalesce(email, ''), '@', 1)
  from auth.users where id = current_user_id
  on conflict (id) do nothing;
  insert into public.app_settings(user_id) values (current_user_id) on conflict (user_id) do nothing;

  update public.accounts set user_id = current_user_id where user_id is null;
  update public.categories set user_id = current_user_id where user_id is null;
  update public.subcategories set user_id = current_user_id where user_id is null;
  update public.trip_projects set user_id = current_user_id where user_id is null;
  update public.properties set user_id = current_user_id where user_id is null;
  update public.recurring_rules set user_id = current_user_id where user_id is null;
  update public.import_batches set user_id = current_user_id where user_id is null;
  update public.transactions set user_id = current_user_id where user_id is null;
  update public.rental_bookings set user_id = current_user_id where user_id is null;
  update public.assets set user_id = current_user_id where user_id is null;
  update public.asset_depreciation_entries set user_id = current_user_id where user_id is null;

  select count(*) into claimed_count from public.transactions where user_id = current_user_id;
  return jsonb_build_object('claimed', true, 'transactions', claimed_count);
end;
$$;

revoke all on function public.claim_initial_dataset() from public, anon;
grant execute on function public.claim_initial_dataset() to authenticated;
revoke all on all functions in schema private from public, anon, authenticated;

-- Data API access is explicit for new Supabase projects. RLS still controls rows.
grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
alter default privileges in schema public grant select, insert, update, delete on tables to authenticated;

-- RLS on every public table, including internal bootstrap state.
alter table public.profiles enable row level security;
alter table public.accounts enable row level security;
alter table public.categories enable row level security;
alter table public.subcategories enable row level security;
alter table public.trip_projects enable row level security;
alter table public.properties enable row level security;
alter table public.recurring_rules enable row level security;
alter table public.import_batches enable row level security;
alter table public.transactions enable row level security;
alter table public.rental_bookings enable row level security;
alter table public.assets enable row level security;
alter table public.asset_depreciation_entries enable row level security;
alter table public.app_settings enable row level security;
alter table public.dataset_claims enable row level security;

create policy profiles_select_own on public.profiles for select to authenticated using ((select auth.uid()) = id);
create policy profiles_update_own on public.profiles for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

create policy accounts_own on public.accounts for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy categories_own on public.categories for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy subcategories_own on public.subcategories for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy trip_projects_own on public.trip_projects for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy properties_own on public.properties for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy recurring_rules_own on public.recurring_rules for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy import_batches_own on public.import_batches for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy transactions_own on public.transactions for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy rental_bookings_own on public.rental_bookings for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy assets_own on public.assets for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy asset_depreciation_entries_own on public.asset_depreciation_entries for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy app_settings_own on public.app_settings for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

comment on function public.claim_initial_dataset() is
  'Atomically assigns the unclaimed initial CSV dataset to the first authenticated user.';
