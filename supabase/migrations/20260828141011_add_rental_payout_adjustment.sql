set statement_timeout = '30s';

-- A platform may apply a correction to the amount transferred to the owner
-- without changing either the reservation total or the agreed commission rates.
alter table public.rental_bookings
  add column if not exists payout_adjustment_amount numeric(14,2) not null default 0;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'rental_bookings_payout_adjustment_non_negative_check'
      and conrelid = 'public.rental_bookings'::regclass
  ) then
    alter table public.rental_bookings
      add constraint rental_bookings_payout_adjustment_non_negative_check
      check (payout_adjustment_amount >= 0);
  end if;
end $$;

comment on column public.rental_bookings.payout_adjustment_amount is
  'Expenses or adjustments deducted from the owner payout after commission calculations.';
