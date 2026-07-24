-- Convert the legacy free-text "Eclipse" group into a real trip project.
-- The migration is deliberately scoped to exact, case-insensitive matches and
-- never overwrites a transaction that already belongs to another trip.
with eclipse_sources as (
  select
    user_id,
    min(transaction_date) as start_date,
    max(transaction_date) as end_date
  from public.transactions
  where user_id is not null
    and trip_project_id is null
    and lower(trim(context)) = 'eclipse'
  group by user_id
)
insert into public.trip_projects (user_id, name, start_date, end_date, is_active)
select source.user_id, 'Eclipse', source.start_date, source.end_date, true
from eclipse_sources source
where not exists (
  select 1
  from public.trip_projects project
  where project.user_id = source.user_id
    and lower(project.name) = 'eclipse'
);

-- If the project existed already without dates, infer them from its expenses.
with eclipse_sources as (
  select
    user_id,
    min(transaction_date) as start_date,
    max(transaction_date) as end_date
  from public.transactions
  where user_id is not null
    and trip_project_id is null
    and lower(trim(context)) = 'eclipse'
  group by user_id
)
update public.trip_projects project
set
  start_date = coalesce(project.start_date, source.start_date),
  end_date = coalesce(project.end_date, source.end_date),
  is_active = true
from eclipse_sources source
where project.user_id = source.user_id
  and lower(project.name) = 'eclipse';

update public.transactions tx
set
  trip_project_id = project.id,
  context = null
from public.trip_projects project
where tx.user_id = project.user_id
  and tx.trip_project_id is null
  and lower(trim(tx.context)) = 'eclipse'
  and lower(project.name) = 'eclipse';
