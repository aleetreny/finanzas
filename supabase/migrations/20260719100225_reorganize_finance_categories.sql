-- Keep the semantic use of a category stable even when the user renames it.
alter table public.categories
  add column if not exists category_scope text not null default 'expense';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.categories'::regclass
      and conname = 'categories_scope_check'
  ) then
    alter table public.categories
      add constraint categories_scope_check
      check (category_scope in ('expense', 'income', 'property'));
  end if;
end;
$$;

update public.categories
set category_scope = case
  when lower(name) = lower('Ingresos') then 'income'
  when lower(name) = lower('Piso Málaga') then 'property'
  else 'expense'
end;

-- Move Cuidado personal below Salud and point every historical entry to the
-- new subcategory before removing the former top-level category.
insert into public.subcategories(user_id, category_id, name, sort_order, is_active)
select
  health.user_id,
  health.id,
  'Cuidado personal',
  coalesce((select max(existing.sort_order) + 1 from public.subcategories existing where existing.category_id = health.id), 0),
  true
from public.categories old_category
join public.categories health
  on health.user_id is not distinct from old_category.user_id
 and lower(health.name) = lower('Salud')
where lower(old_category.name) = lower('Cuidado personal')
  and not exists (
    select 1
    from public.subcategories existing
    where existing.category_id = health.id
      and lower(existing.name) = lower('Cuidado personal')
  );

update public.transactions transaction_row
set
  category_id = health.id,
  subcategory_id = personal_care.id
from public.categories old_category
join public.categories health
  on health.user_id is not distinct from old_category.user_id
 and lower(health.name) = lower('Salud')
join public.subcategories personal_care
  on personal_care.category_id = health.id
 and lower(personal_care.name) = lower('Cuidado personal')
where lower(old_category.name) = lower('Cuidado personal')
  and transaction_row.category_id = old_category.id;

update public.recurring_rules recurring_row
set
  category_id = health.id,
  subcategory_id = personal_care.id
from public.categories old_category
join public.categories health
  on health.user_id is not distinct from old_category.user_id
 and lower(health.name) = lower('Salud')
join public.subcategories personal_care
  on personal_care.category_id = health.id
 and lower(personal_care.name) = lower('Cuidado personal')
where lower(old_category.name) = lower('Cuidado personal')
  and recurring_row.category_id = old_category.id;

delete from public.categories old_category
where lower(old_category.name) = lower('Cuidado personal')
  and exists (
    select 1
    from public.categories health
    where health.user_id is not distinct from old_category.user_id
      and lower(health.name) = lower('Salud')
  );

-- Income taxonomy: preserve the historical foreign keys while changing the
-- visible wording, merge a possible duplicate, and add Investments.
update public.transactions transaction_row
set subcategory_id = replacement.id
from public.subcategories old_subcategory
join public.subcategories replacement
  on replacement.category_id = old_subcategory.category_id
 and lower(replacement.name) = lower('Venta de artículos')
where transaction_row.subcategory_id = old_subcategory.id
  and lower(old_subcategory.name) = lower('Venta de bienes');

update public.recurring_rules recurring_row
set subcategory_id = replacement.id
from public.subcategories old_subcategory
join public.subcategories replacement
  on replacement.category_id = old_subcategory.category_id
 and lower(replacement.name) = lower('Venta de artículos')
where recurring_row.subcategory_id = old_subcategory.id
  and lower(old_subcategory.name) = lower('Venta de bienes');

delete from public.subcategories old_subcategory
where lower(old_subcategory.name) = lower('Venta de bienes')
  and exists (
    select 1
    from public.subcategories replacement
    where replacement.category_id = old_subcategory.category_id
      and lower(replacement.name) = lower('Venta de artículos')
  );

update public.subcategories
set name = 'Venta de artículos'
where lower(name) = lower('Venta de bienes');

insert into public.subcategories(user_id, category_id, name, sort_order, is_active)
select
  income_category.user_id,
  income_category.id,
  'Inversiones',
  coalesce((select max(existing.sort_order) + 1 from public.subcategories existing where existing.category_id = income_category.id), 0),
  true
from public.categories income_category
where income_category.category_scope = 'income'
  and not exists (
    select 1
    from public.subcategories existing
    where existing.category_id = income_category.id
      and lower(existing.name) = lower('Inversiones')
  );

-- Remove the sublet parking domain completely: history, future recurrences,
-- subcategories and the category itself. Occasional personal parking under
-- Transporte / Parking y peajes is intentionally preserved.
delete from public.transactions transaction_row
where transaction_row.category_id in (
    select parking_category.id
    from public.categories parking_category
    where lower(parking_category.name) = lower('Parking subarrendado')
  )
  or lower(coalesce(transaction_row.context, '')) = lower('Parking subarrendado');

delete from public.recurring_rules recurring_row
where recurring_row.category_id in (
    select parking_category.id
    from public.categories parking_category
    where lower(parking_category.name) = lower('Parking subarrendado')
  )
  or lower(coalesce(recurring_row.context, '')) = lower('Parking subarrendado');

delete from public.categories
where lower(name) = lower('Parking subarrendado');

-- Keep the metadata of the repository's original import consistent after the
-- 44 sublet-parking rows are removed from an already-claimed database.
update public.import_batches
set total_rows = 1024,
    imported_rows = 1024,
    rejected_rows = 0
where file_name = 'movimientos_financieros_corregidos.csv'
  and total_rows = 1068
  and imported_rows = 1068;
