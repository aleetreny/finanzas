set statement_timeout = '30s';

-- Forward-only Booking model.
-- Existing rows keep commission_model = 'booking_standard' and their stored rates/amounts.
-- New rows may use 'booking_split_fees': 15% platform commission + 1.3% bank charge.
-- There is intentionally no UPDATE in this migration.
alter table public.rental_bookings
  drop constraint if exists rental_bookings_commission_model_check;

alter table public.rental_bookings
  add constraint rental_bookings_commission_model_check
  check (
    (platform = 'airbnb' and commission_model in ('airbnb_shared_legacy', 'airbnb_host_only'))
    or (platform = 'booking' and commission_model in ('booking_standard', 'booking_split_fees'))
    or (platform = 'direct' and commission_model = 'direct')
    or (platform = 'other' and commission_model = 'other')
  );

comment on column public.rental_bookings.commission_model is
  'Immutable commission profile snapshot. booking_standard is legacy; booking_split_fees is the forward-only Booking model.';
