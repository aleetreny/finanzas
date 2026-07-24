set statement_timeout = '30s';

-- The historical dataset belongs to the account that claimed it. That account
-- keeps the private rental workspace; every later signup receives only the
-- personal-finance taxonomy and starts with no transactions.
create or replace function public.bootstrap_user_workspace()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  owner_user_id uuid;
  has_malaga_access boolean := false;
  starter_taxonomy jsonb := '[
    {"name": "Vivienda", "scope": "expense", "sort_order": 1, "subcategories": ["Alquiler", "Depósitos y reservas", "Suministros", "Alojamiento temporal", "Otros"]},
    {"name": "Comida", "scope": "expense", "sort_order": 2, "subcategories": ["Supermercado", "Comer fuera"]},
    {"name": "Transporte", "scope": "expense", "sort_order": 3, "subcategories": ["Avión", "Tren", "Bus y metro", "Taxi y VTC", "Coche", "Parking y peajes", "Barco", "Otros"]},
    {"name": "Ocio", "scope": "expense", "sort_order": 4, "subcategories": ["Deporte", "Cultura y eventos", "Vida nocturna", "Excursiones y experiencias", "Apuestas", "Otros"]},
    {"name": "Compras", "scope": "expense", "sort_order": 5, "subcategories": ["Ropa y accesorios", "Tecnología", "Regalos", "Libros y papelería", "Hogar y jardín", "Otros"]},
    {"name": "Suscripciones", "scope": "expense", "sort_order": 6, "subcategories": ["IA y software", "Almacenamiento y servicios digitales", "Medios y asociaciones", "Otros"]},
    {"name": "Salud", "scope": "expense", "sort_order": 7, "subcategories": ["Medicamentos", "Médico y tratamientos", "Vacunas", "Seguro médico", "Seguro de viaje", "Cuidado personal", "Otros"]},
    {"name": "Educación", "scope": "expense", "sort_order": 8, "subcategories": ["Matrícula y tasas", "Cursos y certificaciones", "Exámenes e idiomas", "Materiales", "Otros"]},
    {"name": "Tasas y obligaciones", "scope": "expense", "sort_order": 9, "subcategories": ["Impuestos personales", "Multas", "Visados y documentación", "Otros"]},
    {"name": "Ingresos", "scope": "income", "sort_order": 10, "subcategories": ["Trabajo", "Becas y ayudas", "Reembolsos", "Venta de artículos", "Inversiones", "Voluntariado y colaboraciones", "Transporte compartido", "Otros"]},
    {"name": "Otros", "scope": "expense", "sort_order": 11, "subcategories": ["Otros"]}
  ]'::jsonb;
  malaga_taxonomy jsonb := '{
    "name": "Piso Málaga",
    "scope": "property",
    "sort_order": 0,
    "subcategories": ["Ingreso alquiler", "Comunidad", "Electricidad", "Gas y butano", "Limpieza", "Mantenimiento y reparaciones", "Seguros", "Impuestos y tasas", "Reembolsos e indemnizaciones", "Mobiliario y equipamiento", "Otros ingresos/gastos"]
  }'::jsonb;
  category_entry jsonb;
  target_category_id uuid;
  dataset_claimed boolean := false;
  workspace_seeded boolean := false;
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  -- On a fresh installation the first authenticated account still claims the
  -- imported history. On the live project this is already the existing owner.
  begin
    perform public.claim_initial_dataset();
    dataset_claimed := true;
  exception when others then
    dataset_claimed := false;
  end;

  select claimed_by
    into owner_user_id
  from public.dataset_claims
  where dataset_key = 'initial-v1';

  has_malaga_access := owner_user_id = current_user_id;

  if not exists (select 1 from public.accounts where user_id = current_user_id) then
    insert into public.accounts(user_id, name, type, currency, is_default)
    values (current_user_id, 'Cuenta principal', 'bank', 'EUR', true)
    on conflict do nothing;
    workspace_seeded := true;
  end if;

  if not exists (select 1 from public.categories where user_id = current_user_id) then
    for category_entry in select value from jsonb_array_elements(starter_taxonomy) loop
      insert into public.categories(user_id, name, category_scope, sort_order, is_active)
      values (
        current_user_id,
        category_entry ->> 'name',
        category_entry ->> 'scope',
        (category_entry ->> 'sort_order')::integer,
        true
      )
      on conflict do nothing;

      select id
        into target_category_id
      from public.categories
      where user_id = current_user_id
        and lower(name) = lower(category_entry ->> 'name');

      if target_category_id is not null then
        insert into public.subcategories(user_id, category_id, name, sort_order, is_active)
        select
          current_user_id,
          target_category_id,
          subcategory.value,
          subcategory.ordinality - 1,
          true
        from jsonb_array_elements_text(category_entry -> 'subcategories')
          with ordinality as subcategory(value, ordinality)
        on conflict do nothing;
      end if;
    end loop;
    workspace_seeded := true;
  end if;

  if has_malaga_access
    and not exists (
      select 1
      from public.categories
      where user_id = current_user_id
        and category_scope = 'property'
    )
  then
    insert into public.categories(user_id, name, category_scope, sort_order, is_active)
    values (
      current_user_id,
      malaga_taxonomy ->> 'name',
      malaga_taxonomy ->> 'scope',
      (malaga_taxonomy ->> 'sort_order')::integer,
      true
    )
    on conflict do nothing;

    select id
      into target_category_id
    from public.categories
    where user_id = current_user_id
      and category_scope = 'property'
    order by sort_order, id
    limit 1;

    if target_category_id is not null then
      insert into public.subcategories(user_id, category_id, name, sort_order, is_active)
      select
        current_user_id,
        target_category_id,
        subcategory.value,
        subcategory.ordinality - 1,
        true
      from jsonb_array_elements_text(malaga_taxonomy -> 'subcategories')
        with ordinality as subcategory(value, ordinality)
      on conflict do nothing;
    end if;
    workspace_seeded := true;
  end if;

  if has_malaga_access
    and not exists (select 1 from public.properties where user_id = current_user_id)
  then
    insert into public.properties(user_id, name, property_type, is_active)
    values (current_user_id, 'Piso Málaga', 'rental', true)
    on conflict do nothing;
    workspace_seeded := true;
  end if;

  return jsonb_build_object(
    'claimed', dataset_claimed,
    'seeded', workspace_seeded,
    'has_malaga_access', has_malaga_access
  );
end;
$$;

comment on function public.bootstrap_user_workspace() is
  'Creates an isolated personal workspace and reports whether auth.uid() owns the private Málaga dataset.';

revoke all on function public.bootstrap_user_workspace() from public, anon;
grant execute on function public.bootstrap_user_workspace() to authenticated;

-- The public bootstrap is the only supported entrypoint. Keeping the lower
-- level claim function private to the function owner prevents direct probing.
revoke execute on function public.claim_initial_dataset() from authenticated;

-- Materialize every due recurrence through today. The function is an invoker,
-- so normal ownership RLS applies to both the selected rules and inserted rows.
create or replace function public.generate_due_recurring_transactions()
returns integer
language sql
security invoker
set search_path = ''
as $$
  with current_account as (
    select account.id
    from public.accounts account
    where account.user_id = (select auth.uid())
    order by account.is_default desc, account.created_at, account.id
    limit 1
  ),
  due_occurrences as (
    select
      recurring.id as recurring_rule_id,
      occurrence.due_date,
      recurring.name,
      recurring.amount,
      recurring.category_id,
      recurring.subcategory_id,
      recurring.context,
      recurring.notes
    from public.recurring_rules recurring
    cross join lateral (
      select weekly_date::date as due_date
      from generate_series(
        recurring.effective_from::timestamp,
        least(
          coalesce(recurring.effective_until, timezone('Europe/Madrid', now())::date),
          timezone('Europe/Madrid', now())::date
        )::timestamp,
        interval '7 days'
      ) weekly_date
      where recurring.frequency = 'weekly'

      union all

      select least(
        month_start
          + (coalesce(recurring.day_of_month, extract(day from recurring.effective_from)::integer) - 1)
            * interval '1 day',
        month_start + interval '1 month - 1 day'
      )::date as due_date
      from generate_series(
        date_trunc('month', recurring.effective_from)::timestamp,
        date_trunc(
          'month',
          least(
            coalesce(recurring.effective_until, timezone('Europe/Madrid', now())::date),
            timezone('Europe/Madrid', now())::date
          )
        )::timestamp,
        case recurring.frequency
          when 'monthly' then interval '1 month'
          when 'quarterly' then interval '3 months'
          when 'yearly' then interval '1 year'
          else interval '1 month'
        end
      ) month_start
      where recurring.frequency in ('monthly', 'quarterly', 'yearly')
    ) occurrence
    where recurring.user_id = (select auth.uid())
      and recurring.auto_generate
      and recurring.is_active
      and recurring.amount <> 0
      and recurring.effective_from <= timezone('Europe/Madrid', now())::date
      and occurrence.due_date >= recurring.effective_from
      and occurrence.due_date <= least(
        coalesce(recurring.effective_until, timezone('Europe/Madrid', now())::date),
        timezone('Europe/Madrid', now())::date
      )
  ),
  inserted as (
    insert into public.transactions (
      user_id,
      account_id,
      transaction_date,
      name,
      amount,
      direction,
      category_id,
      subcategory_id,
      context,
      recurring_rule_id,
      notes,
      source,
      source_external_id
    )
    select
      (select auth.uid()),
      current_account.id,
      due.due_date,
      due.name,
      due.amount,
      case
        when due.amount > 0 then 'income'::public.transaction_direction
        else 'expense'::public.transaction_direction
      end,
      due.category_id,
      due.subcategory_id,
      due.context,
      due.recurring_rule_id,
      due.notes,
      'recurring'::public.transaction_source,
      due.recurring_rule_id::text || ':' || due.due_date::text
    from due_occurrences due
    cross join current_account
    on conflict (user_id, source, source_external_id) do nothing
    returning 1
  )
  select count(*)::integer from inserted;
$$;

comment on function public.generate_due_recurring_transactions() is
  'Creates missing owned recurring transactions through the current Europe/Madrid date without duplicates.';

revoke all on function public.generate_due_recurring_transactions() from public, anon;
grant execute on function public.generate_due_recurring_transactions() to authenticated;

-- The invite-only public signup Edge Function uses this anonymous fingerprint
-- counter. It stores no raw IP address and is unreachable from client roles.
create table if not exists public.signup_rate_limits (
  fingerprint text primary key,
  window_started_at timestamptz not null default now(),
  attempt_count integer not null default 1 check (attempt_count > 0),
  updated_at timestamptz not null default now()
);

alter table public.signup_rate_limits enable row level security;
revoke all on table public.signup_rate_limits from public, anon, authenticated;
grant select, insert, update, delete on table public.signup_rate_limits to service_role;

create or replace function public.consume_signup_attempt(p_fingerprint text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  allowed boolean;
begin
  if length(p_fingerprint) <> 64 then
    return false;
  end if;

  delete from public.signup_rate_limits
  where updated_at < now() - interval '24 hours';

  insert into public.signup_rate_limits (
    fingerprint,
    window_started_at,
    attempt_count,
    updated_at
  )
  values (p_fingerprint, now(), 1, now())
  on conflict (fingerprint) do update
  set
    window_started_at = case
      when public.signup_rate_limits.window_started_at <= now() - interval '1 hour'
        then now()
      else public.signup_rate_limits.window_started_at
    end,
    attempt_count = case
      when public.signup_rate_limits.window_started_at <= now() - interval '1 hour'
        then 1
      else public.signup_rate_limits.attempt_count + 1
    end,
    updated_at = now()
  returning attempt_count <= 5 into allowed;

  return allowed;
end;
$$;

comment on function public.consume_signup_attempt(text) is
  'Rate-limits the invite-only public signup Edge Function without retaining raw IP addresses.';

revoke all on function public.consume_signup_attempt(text) from public, anon, authenticated;
grant execute on function public.consume_signup_attempt(text) to service_role;
