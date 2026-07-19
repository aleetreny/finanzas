set statement_timeout = '30s';

-- Every booking stores its own commission model, rates and optional real-world
-- overrides. Global profile changes can therefore never alter historical rows.
alter table public.rental_bookings
  add column if not exists commission_model text,
  add column if not exists accommodation_final numeric(14,2),
  add column if not exists platform_commission_override_amount numeric(14,2),
  add column if not exists manager_payment_override_amount numeric(14,2);

-- Recover the platform for the imported July bank entries before assigning a
-- commission profile. Existing Airbnb entries belong to the legacy shared fee.
update public.rental_bookings booking
set platform = case
  when lower(linked.name) = lower('Airbnb') then 'airbnb'::public.booking_platform
  when lower(linked.name) = lower('Booking') then 'booking'::public.booking_platform
  else booking.platform
end
from public.transactions linked
where linked.id = booking.linked_transaction_id
  and lower(linked.name) in (lower('Airbnb'), lower('Booking'));

update public.rental_bookings
set platform = 'direct'::public.booking_platform
where source_key = 'long-term-2026-h1';

update public.rental_bookings
set commission_model = case platform
  when 'airbnb'::public.booking_platform then 'airbnb_shared_legacy'
  when 'booking'::public.booking_platform then 'booking_standard'
  when 'direct'::public.booking_platform then 'direct'
  else 'other'
end
where commission_model is null;

-- Translate the former form semantics (gross accommodation before discount +
-- separate cleaning) into accommodation after discount and a canonical gross
-- total that includes cleaning. The discount remains informative only.
update public.rental_bookings
set
  accommodation_final = greatest(gross_before_discount - discount_amount, 0),
  cleaning_fee = greatest(cleaning_fee, manager_cleaning_amount, 0);

update public.rental_bookings
set
  gross_before_discount = accommodation_final + cleaning_fee,
  guest_paid_after_discount = accommodation_final + cleaning_fee,
  manager_cleaning_amount = cleaning_fee;

update public.rental_bookings
set platform_commission_rate = case
  when platform_commission_rate <> 0 then platform_commission_rate
  when commission_model = 'airbnb_shared_legacy' then 0.03 * 1.21
  when commission_model = 'airbnb_host_only' then 0.155 * 1.21
  when commission_model = 'booking_standard' then 0.15 + 0.013
  else 0
end;

update public.rental_bookings
set manager_rate = case
  when source_key = 'long-term-2026-h1' then 0
  when manager_rate <> 0 then manager_rate
  else 0.18
end;

update public.rental_bookings
set
  platform_commission_override_amount = case
    when manual_override and platform_commission_amount > 0 then platform_commission_amount
    else null
  end,
  manager_payment_override_amount = case
    when manual_override and amount_payable_to_manager > 0 then amount_payable_to_manager
    else null
  end;

-- "Hasta" is now checkout (exclusive). Preserve the six complete months of
-- the long-term rent and repair imported same-day placeholders to one night.
update public.rental_bookings
set check_out_date = date '2026-07-01'
where source_key = 'long-term-2026-h1';

update public.rental_bookings
set check_out_date = check_in_date + 1
where check_out_date <= check_in_date;

alter table public.rental_bookings
  alter column commission_model set default 'other',
  alter column commission_model set not null,
  alter column accommodation_final set default 0,
  alter column accommodation_final set not null;

alter table public.rental_bookings
  drop constraint if exists rental_bookings_required_period_check;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'rental_bookings_required_period_check'
      and conrelid = 'public.rental_bookings'::regclass
  ) then
    alter table public.rental_bookings
      add constraint rental_bookings_required_period_check
      check (
        check_in_date is not null
        and check_out_date is not null
        and check_out_date > check_in_date
      );
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'rental_bookings_commission_model_check'
      and conrelid = 'public.rental_bookings'::regclass
  ) then
    alter table public.rental_bookings
      add constraint rental_bookings_commission_model_check
      check (
        (platform = 'airbnb' and commission_model in ('airbnb_shared_legacy', 'airbnb_host_only'))
        or (platform = 'booking' and commission_model = 'booking_standard')
        or (platform = 'direct' and commission_model = 'direct')
        or (platform = 'other' and commission_model = 'other')
      );
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'rental_bookings_rate_snapshot_check'
      and conrelid = 'public.rental_bookings'::regclass
  ) then
    alter table public.rental_bookings
      add constraint rental_bookings_rate_snapshot_check
      check (
        platform_commission_rate between 0 and 1
        and manager_rate between 0 and 1
      );
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'rental_bookings_override_non_negative_check'
      and conrelid = 'public.rental_bookings'::regclass
  ) then
    alter table public.rental_bookings
      add constraint rental_bookings_override_non_negative_check
      check (
        accommodation_final >= 0
        and cleaning_fee >= 0
        and (platform_commission_override_amount is null or platform_commission_override_amount >= 0)
        and (manager_payment_override_amount is null or manager_payment_override_amount >= 0)
        and amount_payable_to_manager >= 0
      );
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'rental_bookings_canonical_amounts_check'
      and conrelid = 'public.rental_bookings'::regclass
  ) then
    alter table public.rental_bookings
      add constraint rental_bookings_canonical_amounts_check
      check (
        gross_before_discount = accommodation_final + cleaning_fee
        and guest_paid_after_discount = gross_before_discount
        and manager_cleaning_amount = cleaning_fee
      );
  end if;
end $$;

comment on column public.rental_bookings.commission_model is
  'Immutable commission profile snapshot selected when the booking is saved.';
comment on column public.rental_bookings.platform_commission_rate is
  'Effective platform rate snapshot as a fraction, including taxes when applicable.';
comment on column public.rental_bookings.manager_rate is
  'Manager/cohost commission rate snapshot as a fraction.';
comment on column public.rental_bookings.platform_commission_override_amount is
  'Optional real platform commission; null means use the profile calculation.';
comment on column public.rental_bookings.manager_payment_override_amount is
  'Optional real total paid to manager/cohost; null means use the profile calculation.';
