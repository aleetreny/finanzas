alter table public.transactions
  add column if not exists allocation_start_date date,
  add column if not exists allocation_end_date date;

alter table public.transactions
  drop constraint if exists transactions_allocation_period_valid;

alter table public.transactions
  add constraint transactions_allocation_period_valid check (
    (allocation_start_date is null and allocation_end_date is null)
    or (
      allocation_start_date is not null
      and allocation_end_date is not null
      and allocation_end_date >= allocation_start_date
    )
  );

comment on column public.transactions.allocation_start_date is
  'Optional start date for monthly allocation analysis; transaction_date remains the bank/payment date.';
comment on column public.transactions.allocation_end_date is
  'Optional end date for monthly allocation analysis; paired with allocation_start_date.';
