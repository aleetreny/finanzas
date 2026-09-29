set statement_timeout = '30s';

-- Forward-only support for Booking cleaning:
-- the guest is charged 70 EUR while the manager receives 60 EUR.
-- Existing reservations are not updated.
alter table public.rental_bookings
  drop constraint if exists rental_bookings_canonical_amounts_check;

alter table public.rental_bookings
  add constraint rental_bookings_canonical_amounts_check
  check (
    gross_before_discount = accommodation_final + cleaning_fee
    and guest_paid_after_discount = gross_before_discount
    and manager_cleaning_amount >= 0
  );

comment on column public.rental_bookings.cleaning_fee is
  'Cleaning amount charged to the guest and included in gross booking revenue.';

comment on column public.rental_bookings.manager_cleaning_amount is
  'Cleaning amount actually payable to the manager/cohost; may differ from the guest cleaning charge.';
