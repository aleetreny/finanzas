set statement_timeout = '30s';

-- Alta multiusuario: cualquier usuario autenticado obtiene un espacio de
-- trabajo listo para usar. El primer usuario conserva la reclamación del
-- dataset histórico; el resto recibe cuenta por defecto, taxonomía inicial y
-- su propia propiedad. La función es idempotente y solo opera sobre auth.uid().

create function public.bootstrap_user_workspace()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  starter_taxonomy jsonb := '[
    {"name": "Piso Málaga", "scope": "property", "sort_order": 0, "subcategories": ["Ingreso alquiler", "Comunidad", "Electricidad", "Gas y butano", "Limpieza", "Mantenimiento y reparaciones", "Seguros", "Impuestos y tasas", "Reembolsos e indemnizaciones", "Mobiliario y equipamiento", "Otros ingresos/gastos"]},
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
  category_entry jsonb;
  target_category_id uuid;
  dataset_claimed boolean := false;
  workspace_seeded boolean := false;
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  -- El dataset histórico mantiene su semántica original de reclamación única:
  -- si ya está asignado (o falla), se continúa con el aprovisionamiento normal.
  begin
    perform public.claim_initial_dataset();
    dataset_claimed := true;
  exception when others then
    dataset_claimed := false;
  end;

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

      select id into target_category_id
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

  if not exists (select 1 from public.properties where user_id = current_user_id) then
    insert into public.properties(user_id, name, property_type, is_active)
    values (current_user_id, 'Piso Málaga', 'rental', true)
    on conflict do nothing;
    workspace_seeded := true;
  end if;

  return jsonb_build_object('claimed', dataset_claimed, 'seeded', workspace_seeded);
end;
$$;

comment on function public.bootstrap_user_workspace() is
  'Alta idempotente por usuario: el primero reclama el dataset histórico y el resto recibe cuenta por defecto, taxonomía inicial y propiedad propia. Solo opera sobre auth.uid().';

revoke all on function public.bootstrap_user_workspace() from public, anon;
grant execute on function public.bootstrap_user_workspace() to authenticated;
