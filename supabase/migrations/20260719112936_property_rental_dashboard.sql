set statement_timeout = '30s';

-- Rental bookings become the canonical source for rental income. The legacy
-- calculator columns remain populated for backwards compatibility, while the
-- UI exposes a single income type and the five fiscal amounts requested.
alter table public.rental_bookings
  add column if not exists name text,
  add column if not exists allocation_method text,
  add column if not exists source_key text;

update public.rental_bookings
set
  name = coalesce(nullif(trim(name), ''), 'Alquiler'),
  allocation_method = coalesce(allocation_method, 'daily');

alter table public.rental_bookings
  alter column name set default 'Alquiler',
  alter column name set not null,
  alter column allocation_method set default 'daily',
  alter column allocation_method set not null,
  alter column platform set default 'other';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'rental_bookings_allocation_method_check'
      and conrelid = 'public.rental_bookings'::regclass
  ) then
    alter table public.rental_bookings
      add constraint rental_bookings_allocation_method_check
      check (allocation_method in ('daily', 'monthly'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'rental_bookings_required_period_check'
      and conrelid = 'public.rental_bookings'::regclass
  ) then
    alter table public.rental_bookings
      add constraint rental_bookings_required_period_check
      check (
        check_in_date is not null
        and check_out_date is not null
        and check_out_date >= check_in_date
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'rental_bookings_breakdown_non_negative_check'
      and conrelid = 'public.rental_bookings'::regclass
  ) then
    alter table public.rental_bookings
      add constraint rental_bookings_breakdown_non_negative_check
      check (
        gross_before_discount >= 0
        and discount_amount >= 0
        and platform_commission_amount >= 0
        and manager_commission_amount >= 0
        and manager_cleaning_amount >= 0
      );
  end if;
end $$;

create unique index if not exists rental_bookings_property_source_key_unique
  on public.rental_bookings(property_id, source_key)
  where source_key is not null;

create unique index if not exists rental_bookings_linked_transaction_unique
  on public.rental_bookings(linked_transaction_id)
  where linked_transaction_id is not null;

create index if not exists rental_bookings_user_period_idx
  on public.rental_bookings(user_id, check_in_date, check_out_date);

grant select, insert, update, delete on table public.rental_bookings to authenticated;

-- Replace the former platform/residential income concepts with one rental
-- income concept. Reimbursements and other property income remain separate.
insert into public.subcategories(
  id, user_id, category_id, name, sort_order, is_active
)
select
  gen_random_uuid(),
  category.user_id,
  category.id,
  'Ingreso alquiler',
  0,
  true
from public.categories category
where category.category_scope = 'property'
  and not exists (
    select 1
    from public.subcategories existing
    where existing.category_id = category.id
      and lower(existing.name) = lower('Ingreso alquiler')
  );

with canonical as (
  select subcategory.id, subcategory.category_id
  from public.subcategories subcategory
  where lower(subcategory.name) = lower('Ingreso alquiler')
), legacy as (
  select subcategory.id, subcategory.category_id
  from public.subcategories subcategory
  where lower(subcategory.name) in (
    lower('Ingreso alquiler residencial'),
    lower('Ingreso Airbnb'),
    lower('Ingreso Booking'),
    lower('Ingreso alquiler turístico - directo/otro')
  )
)
update public.transactions transaction_row
set
  subcategory_id = canonical.id,
  platform = null
from legacy
join canonical on canonical.category_id = legacy.category_id
where transaction_row.subcategory_id = legacy.id;

with canonical as (
  select subcategory.id, subcategory.category_id
  from public.subcategories subcategory
  where lower(subcategory.name) = lower('Ingreso alquiler')
), legacy as (
  select subcategory.id, subcategory.category_id
  from public.subcategories subcategory
  where lower(subcategory.name) in (
    lower('Ingreso alquiler residencial'),
    lower('Ingreso Airbnb'),
    lower('Ingreso Booking'),
    lower('Ingreso alquiler turístico - directo/otro')
  )
)
update public.recurring_rules recurring_row
set subcategory_id = canonical.id
from legacy
join canonical on canonical.category_id = legacy.category_id
where recurring_row.subcategory_id = legacy.id;

delete from public.subcategories subcategory
where lower(subcategory.name) in (
  lower('Ingreso alquiler residencial'),
  lower('Ingreso Airbnb'),
  lower('Ingreso Booking'),
  lower('Ingreso alquiler turístico - directo/otro')
);

update public.subcategories
set sort_order = 0, is_active = true
where lower(name) = lower('Ingreso alquiler');

-- One long-term rental replaces the nine bank entries from January to June.
insert into public.rental_bookings(
  user_id,
  property_id,
  platform,
  name,
  booking_date,
  check_in_date,
  check_out_date,
  discount_amount,
  cleaning_fee,
  guest_paid_after_discount,
  gross_before_discount,
  platform_commission_amount,
  manager_commission_amount,
  manager_cleaning_amount,
  payout_received,
  amount_payable_to_manager,
  owner_net_after_manager,
  calculation_status,
  manual_override,
  allocation_method,
  source_key,
  notes
)
select
  property.user_id,
  property.id,
  'other',
  'Alquiler enero-junio',
  date '2026-01-01',
  date '2026-01-01',
  date '2026-06-30',
  0,
  0,
  7200,
  7200,
  0,
  0,
  0,
  7200,
  0,
  7200,
  'reconciled',
  true,
  'monthly',
  'long-term-2026-h1',
  'Alquiler de 1 de enero a 30 de junio: 1.200 € por cada mes.'
from public.properties property
where lower(property.name) = lower('Piso Málaga')
on conflict (property_id, source_key) where source_key is not null do nothing;

with deleted as (
  delete from public.transactions transaction_row
  using public.categories category, public.subcategories subcategory
  where transaction_row.category_id = category.id
    and transaction_row.subcategory_id = subcategory.id
    and category.category_scope = 'property'
    and lower(subcategory.name) = lower('Ingreso alquiler')
    and transaction_row.direction = 'income'
    and transaction_row.transaction_date between date '2026-01-01' and date '2026-06-30'
  returning transaction_row.import_batch_id
), removed_by_batch as (
  select import_batch_id, count(*)::integer as removed_rows
  from deleted
  where import_batch_id is not null
  group by import_batch_id
)
update public.import_batches import_batch
set
  total_rows = greatest(0, import_batch.total_rows - removed.removed_rows),
  imported_rows = greatest(0, import_batch.imported_rows - removed.removed_rows)
from removed_by_batch removed
where import_batch.id = removed.import_batch_id;

-- Existing rental income from July 2026 becomes editable reservations. The
-- current bank amount is used as the initial gross amount and marked for review.
insert into public.rental_bookings(
  user_id,
  property_id,
  platform,
  name,
  booking_date,
  check_in_date,
  check_out_date,
  discount_amount,
  cleaning_fee,
  guest_paid_after_discount,
  gross_before_discount,
  platform_commission_amount,
  manager_commission_amount,
  manager_cleaning_amount,
  payout_received,
  amount_payable_to_manager,
  owner_net_after_manager,
  calculation_status,
  manual_override,
  linked_transaction_id,
  allocation_method,
  source_key,
  notes
)
select
  transaction_row.user_id,
  property.id,
  'other',
  case
    when lower(transaction_row.name) in ('airbnb', 'booking') then 'Reserva ' || to_char(transaction_row.transaction_date, 'DD/MM/YYYY')
    else transaction_row.name
  end,
  transaction_row.transaction_date,
  transaction_row.transaction_date,
  transaction_row.transaction_date,
  0,
  0,
  transaction_row.amount,
  transaction_row.amount,
  0,
  0,
  0,
  transaction_row.amount,
  0,
  transaction_row.amount,
  'needs_review',
  true,
  transaction_row.id,
  'daily',
  'transaction:' || transaction_row.id::text,
  'Pendiente de completar fechas, descuentos y comisiones. Importe inicial tomado del cobro bancario existente.'
from public.transactions transaction_row
join public.categories category on category.id = transaction_row.category_id
join public.subcategories subcategory on subcategory.id = transaction_row.subcategory_id
join public.properties property
  on property.user_id is not distinct from transaction_row.user_id
  and lower(property.name) = lower('Piso Málaga')
where category.category_scope = 'property'
  and lower(subcategory.name) = lower('Ingreso alquiler')
  and transaction_row.direction = 'income'
  and transaction_row.transaction_date >= date '2026-07-01'
on conflict (property_id, source_key) where source_key is not null do nothing;

-- Community is already recorded through July. From August onwards this rule
-- makes it appear automatically when each month arrives, without duplicates.
insert into public.recurring_rules(
  user_id,
  name,
  amount,
  frequency,
  day_of_month,
  effective_from,
  category_id,
  subcategory_id,
  context,
  auto_generate,
  is_active,
  notes
)
select
  category.user_id,
  'Comunidad',
  -70.80,
  'monthly',
  1,
  date '2026-08-01',
  category.id,
  subcategory.id,
  'Piso Málaga',
  true,
  true,
  'Gasto mensual del piso; aparece automáticamente a partir de agosto de 2026.'
from public.categories category
join public.subcategories subcategory
  on subcategory.category_id = category.id
  and lower(subcategory.name) = lower('Comunidad')
where category.category_scope = 'property'
  and not exists (
    select 1
    from public.recurring_rules existing
    where existing.category_id = category.id
      and lower(existing.name) = lower('Comunidad')
      and existing.effective_from = date '2026-08-01'
  );
