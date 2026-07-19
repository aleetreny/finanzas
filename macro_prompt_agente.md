# PROMPT MAESTRO PARA CONSTRUIR LA WEB DE FINANZAS

Actúa como ingeniero full-stack sénior y responsable técnico del producto. Debes construir desde cero una aplicación personal de finanzas centrada primero en la lógica, la integridad de los datos y la facilidad de registro. No pierdas tiempo de momento con una estética sofisticada.

## 1. Objetivo

Construye una única aplicación responsive que funcione correctamente:

- En ordenador.
- En móvil.
- Como PWA instalable desde el navegador en la pantalla de inicio.
- Con un formulario muy rápido para registrar movimientos.
- Con Supabase como base de datos, autenticación y backend.
- Con importación y exportación CSV.
- Con una arquitectura preparada para gráficos y análisis posteriores.

La aplicación sustituirá gradualmente a una hoja de Numbers. El archivo `movimientos_financieros_corregidos.csv` contiene el histórico definitivo que debe importarse.

## 2. Flujo obligatorio para Supabase

No reutilices un proyecto existente. Crea un proyecto nuevo y separado para esta aplicación.

Usa el plugin de Supabase siguiendo este orden:

1. Lista las organizaciones disponibles y localiza la organización ya creada del usuario.
2. Consulta el coste y las regiones disponibles para crear un nuevo proyecto.
3. Muestra al usuario el coste exacto y las regiones razonables en Europa.
4. Pide confirmación explícita del coste y de la región.
5. Solo después de esa confirmación, crea el proyecto.
6. Espera a que esté operativo antes de continuar.
7. Configura las variables de entorno necesarias sin exponer la `service_role_key` en el cliente.

Esta confirmación de coste y región es la única interrupción que debes provocar. Después, trabaja de forma autónoma hasta entregar una primera versión funcional.

## 3. Stack recomendado

Usa:

- Next.js con App Router.
- TypeScript estricto.
- Tailwind CSS únicamente para una interfaz básica y legible.
- Supabase JS.
- React Hook Form y Zod.
- Una librería sencilla de gráficos, pero no dediques tiempo a personalizarlos todavía.
- Vitest o Jest para las fórmulas y reglas de negocio.
- Playwright para al menos los flujos principales.
- ESLint y formateo consistente.

No construyas dos aplicaciones separadas. La versión móvil y la de escritorio deben salir de la misma base de código responsive.

## 4. Principios de producto

- Registrar un gasto debe requerir el menor número posible de pulsaciones.
- Las categorías y subcategorías deben ser editables desde ajustes.
- Los campos avanzados deben ser opcionales y estar ocultos por defecto.
- No alteres movimientos históricos para “cuadrar” análisis.
- Los reembolsos son movimientos reales y deben conservarse.
- Los cálculos automáticos deben mostrar siempre su desglose antes de guardar.
- Toda cifra calculada debe poder editarse manualmente.
- Los importes se guardan con dos decimales.
- Usa una sola fuente de verdad en Supabase.
- No dependas de Numbers ni de iCloud para el funcionamiento diario.
- Permite exportar todos los datos en cualquier momento.

## 5. Modelo de datos mínimo

Crea migraciones SQL versionadas. Como mínimo incluye:

### `profiles`
- `id`
- `email`
- `display_name`
- timestamps

### `accounts`
- `id`
- `user_id`
- `name`
- `type`
- `currency`
- `is_default`
- timestamps

Crea inicialmente una cuenta genérica llamada `Cuenta principal`, ya que el CSV histórico no contiene cuentas.

### `categories`
- `id`
- `user_id`
- `name`
- `sort_order`
- `is_active`

### `subcategories`
- `id`
- `category_id`
- `name`
- `sort_order`
- `is_active`

### `transactions`
- `id`
- `user_id`
- `account_id`
- `transaction_date`
- `name`
- `amount`
- `direction`: `income`, `expense` o `neutral`
- `category_id`
- `subcategory_id`
- `context`
- `platform`
- `trip_project_id`
- `recurring_rule_id`
- `fiscal_property_status`
- `notes`
- `source`: `manual`, `csv_import`, `recurring`, `rental_calculator`
- `source_external_id`
- `import_batch_id`
- timestamps

El importe debe conservar el signo del CSV. Añade una restricción que haga coherente el signo con `direction`.

### `import_batches`
- `id`
- `user_id`
- nombre del archivo
- hash del archivo
- filas totales
- filas importadas
- filas rechazadas
- timestamps

La importación debe ser idempotente. Usa `source_external_id` o una clave equivalente para impedir duplicados al volver a importar el mismo archivo.

### `trip_projects`
- `id`
- `user_id`
- `name`
- `start_date`
- `end_date`
- `is_active`

Es una etiqueta opcional. No sustituye a la categoría principal.

### `recurring_rules`
- `id`
- `user_id`
- `name`
- `amount`
- `frequency`
- `day_of_month`
- `effective_from`
- `effective_until`
- categoría, subcategoría y contexto
- `auto_generate`
- `is_active`
- timestamps

Los cambios de importe se hacen creando una nueva vigencia. Nunca se reescriben movimientos históricos.

### `properties`
Crea inicialmente `Piso Málaga`.

Campos:
- `id`
- `user_id`
- `name`
- `property_type`
- `is_active`
- notas

### `rental_bookings`
- `id`
- `user_id`
- `property_id`
- `name`
- `check_in_date` y `check_out_date` obligatorias
- `discount_amount`
- `gross_before_discount`
- `platform_commission_amount`
- `manager_commission_amount`
- `manager_cleaning_amount`
- `allocation_method`: `daily` o `monthly`
- `calculation_status`
- `linked_transaction_id`
- `source_key`
- timestamps

### `assets`
Para inmovilizado y amortizaciones:

- `id`
- `user_id`
- `property_id` opcional
- `linked_transaction_id` opcional
- `name`
- `asset_type`
- `acquisition_date`
- `cost`
- `amortization_method`
- `annual_rate`
- `useful_life_years`
- `residual_value`
- `business_use_percentage`
- `start_date`
- `notes`
- timestamps

### `asset_depreciation_entries`
- `asset_id`
- `fiscal_year`
- base inicial
- amortización del año
- amortización acumulada
- valor pendiente

Los porcentajes deben ser configurables. No presentes una tasa como una conclusión fiscal automática.

## 6. Seguridad

- Implementa autenticación de Supabase.
- La aplicación es inicialmente para un solo usuario, pero todas las tablas deben incluir `user_id`.
- Activa RLS en todas las tablas privadas.
- Crea políticas para que cada usuario solo pueda leer y modificar sus propios datos.
- Nunca uses la clave de servicio en código cliente.
- Valida también en servidor todas las operaciones de escritura.

## 7. Taxonomía inicial

Carga el archivo `catalogo_categorias.csv`. Las categorías principales son:

- Piso Málaga
- Vivienda personal
- Comida
- Transporte
- Ocio
- Compras
- Suscripciones
- Salud
- Educación
- Tasas y obligaciones
- Ingresos
- Otros

Respeta exactamente los nombres `Vida nocturna` y `Cultura y eventos`.

## 8. Importación del histórico

Importa `movimientos_financieros_corregidos.csv`.

Requisitos:

1. El archivo está en UTF-8 con BOM.
2. Usa punto decimal en `importe_eur`.
3. La fecha está en ISO `YYYY-MM-DD`.
4. El separador es punto y coma.
5. Hay 1.024 movimientos.
6. No existen las dos filas vacías del CSV original.
7. Conserva `fila_original`, `categoria_original` y `nota_migracion` como metadatos o dentro de un JSON de importación si no quieres añadir columnas permanentes.
8. Muestra una vista previa antes de confirmar.
9. Informa de errores por fila sin cancelar todas las filas válidas.
10. No dupliques datos si se importa de nuevo.

No cambies fechas ni importes durante la importación.

## 9. Reglas del piso de Málaga

El contexto `Piso Málaga` debe permitir filtrar de forma independiente:

- Un único ingreso de alquiler, con desglose por reserva.
- Comunidad.
- Electricidad.
- Gas y butano.
- Limpieza.
- Mantenimiento.
- Seguros.
- Impuestos y tasas.
- Reembolsos e indemnizaciones.
- Mobiliario y equipamiento.
- Posibles inmovilizados.

Los pagos personales de IRPF llamados `Renta` no son automáticamente un gasto deducible del piso.

Los movimientos `Aire acondicionado` y `Cerradura` son candidatos a inmovilizado o mejora, pero no debes crear una amortización definitiva sin confirmación del usuario.

## 10. Reservas e ingresos del piso

Existe un único tipo de ingreso por alquiler, sin separar el ingreso por plataforma. El formulario visible de cada reserva contiene concepto, entrada, salida, plataforma, alojamiento final después de descuentos y limpieza. La salida es exclusiva y las noches se calculan como `check_out_date - check_in_date`.

La plataforma guarda un perfil inmutable dentro de cada reserva:

- Airbnb compartida antigua: `3 % × 1,21`;
- Airbnb íntegra al propietario: `15,5 % × 1,21`;
- Booking: `15 % + 1,3 %`;
- Directa: `0 %`;
- Gestora: `18 %` por defecto.

Airbnb nueva es el perfil predeterminado para nuevas reservas de Airbnb. En ajustes avanzados se pueden editar ambos porcentajes, anotar un descuento informativo y sobrescribir la comisión real de plataforma o el pago total real al cohost. Los overrides vacíos usan el cálculo automático; un valor, incluido cero, sustituye el resultado calculado.

El total bruto es alojamiento final más limpieza. El descuento no se vuelve a restar. La comisión de gestora se calcula sobre el total después de plataforma y sin limpieza; su pago total incluye la limpieza. El neto es `total_bruto - comision_plataforma_usada - pago_gestora_usado`.

Los importes se reparten por noches entre los meses que abarque la reserva. Para alquileres mensuales completos se permite reparto uniforme por meses. Cada componente conserva exactamente sus céntimos. En los resúmenes, descuentos, comisiones y pagos a la gestora se muestran con signo negativo.

## 11. Histórico y ejercicio 2026

- Enero-junio de 2026 se registra como una reserva única de 7.200 €, repartida en seis mensualidades de 1.200 €.
- Los cobros desde julio de 2026 se convierten en reservas editables marcadas como pendientes de completar.
- No se inventan descuentos ni comisiones que no consten.
- El histórico anterior a julio de 2026 no requiere reconstrucción detallada.

## 12. Dashboard anual del piso

La página muestra por ejercicio el ingreso, los gastos y el neto acumulado; un desglose mensual por descuentos, comisiones, limpieza, recurrentes y otros gastos; y una tabla anual por categorías para facilitar la preparación de la renta.

## 13. Movimientos recurrentes

Importa `recurrentes_iniciales.csv`, que inicialmente solo contiene la cabecera.

Requisitos:

- No generes meses anteriores.
- No modifiques los importes históricos ya importados.
- Evita duplicados si el usuario abre la aplicación varias veces.
- Permite pausar, editar o finalizar una regla.
- Para cambiar una cantidad futura, crea una nueva vigencia.
- Muestra los movimientos pendientes antes de confirmarlos o permite generación automática configurable.

## 14. Reembolsos

No elimines el movimiento `Noel +500 €`.

Es un reembolso de vuelos de Tailandia pagados por adelantado. El gasto completo y el reembolso deben permanecer porque ambos ocurrieron en el flujo de caja.

Para análisis personales, permite:

- Ver gasto bruto.
- Ver reembolsos.
- Ver gasto neto tras reembolsos.

No borres media compra de vuelos ni alteres la transacción original.

## 15. Páginas de la primera versión

Construye primero estas rutas:

1. `/dashboard`
   - saldo neto del periodo
   - ingresos
   - gastos
   - distribución por categorías
   - evolución mensual
   - filtros básicos

2. `/movimientos`
   - tabla y vista móvil
   - búsqueda
   - filtros
   - edición
   - eliminación con confirmación

3. `/movimientos/nuevo`
   - formulario rápido
   - fecha por defecto hoy
   - importe
   - ingreso o gasto
   - categoría
   - subcategoría
   - nombre
   - campos avanzados desplegables

4. `/piso-malaga`
   - reservas con periodo y desglose editable
   - resultado neto y reparto mensual
   - tabla fiscal por ejercicio
   - gastos periódicos
   - gastos adicionales e inmovilizado

6. `/recurrentes`
   - reglas
   - vigencias
   - próximas generaciones

7. `/inmovilizado`
   - activos
   - tabla anual de amortización
   - valor pendiente

8. `/importar-exportar`
   - vista previa CSV
   - importación
   - historial de lotes
   - exportación completa

9. `/ajustes`
   - categorías
   - subcategorías
   - cuenta por defecto

## 16. Experiencia móvil

En móvil:

- Botón fijo visible para añadir movimiento.
- Campos grandes y utilizables con una mano.
- Selector de categorías con búsqueda.
- Guardado rápido.
- Manifest PWA, iconos y modo standalone.
- No hace falta soporte offline completo todavía.
- Evita tablas anchas: usa tarjetas o listas adaptadas.

## 17. Gráficos y métricas iniciales

Implementa gráficos básicos, sin dedicar tiempo al diseño:

- Ingresos y gastos por mes.
- Gastos por categoría.
- Resultado del Piso Málaga por mes y año.
- Comparación de periodos.

Los filtros deben compartir estado y afectar a las métricas y gráficos.

## 18. Amortizaciones

Implementa una calculadora general:

- Coste.
- Fecha de adquisición.
- Tasa anual configurable.
- Porcentaje de uso afecto configurable.
- Método lineal inicialmente.
- Amortización por año natural prorrateada por días o meses, con una única convención documentada.
- Amortización acumulada.
- Valor pendiente.
- Vista por ejercicio.

No conviertas automáticamente todos los gastos grandes en inmovilizado.

Los movimientos del aire acondicionado y la cerradura deben aparecer como candidatos para revisión.

## 19. Calidad y pruebas

Debes incluir:

- Tests unitarios del reparto diario y mensual de reservas, perfiles de comisión y overrides exactos.
- Test de importación de 1.024 filas.
- Test de idempotencia del CSV.
- Test de generación de recurrentes sin duplicados.
- Test de separación de los movimientos del Piso Málaga.
- Test de RLS o comprobación equivalente.
- Validación Zod en formularios y endpoints.
- Estados de carga y errores comprensibles.
- README con instrucciones para desarrollo, migraciones y despliegue.

## 20. Orden de trabajo

Sigue estas fases:

### Fase 1
- Crear o conectar Supabase tras la confirmación.
- Inicializar proyecto.
- Migraciones, RLS y tipos.
- Cargar catálogo de categorías.

### Fase 2
- Importador CSV.
- Importar y validar los 1.024 movimientos.
- CRUD de movimientos.

### Fase 3
- Recurrentes configurables.
- Reservas, desglose y prorrateo con tests.

### Fase 4
- Piso Málaga e inmovilizado.
- Dashboard mínimo.

### Fase 5
- PWA y adaptación móvil.
- Exportación.
- Pruebas finales y documentación.

## 21. Criterios de aceptación

La primera versión se considera lista cuando:

- El proyecto usa un Supabase nuevo.
- El histórico contiene exactamente 1.024 movimientos sin duplicados.
- La suma total de importes coincide con 14.276,66 €.
- Se puede añadir, editar y eliminar un movimiento desde móvil y escritorio.
- Las categorías coinciden con el catálogo.
- El reparto de reservas conserva todos los céntimos y respeta su periodo.
- El piso de Málaga tiene una vista separada.
- Los candidatos a inmovilizado se pueden revisar.
- La aplicación es instalable como PWA.
- RLS impide acceder a datos de otro usuario.
- Existe exportación CSV completa.
- El README permite ejecutar el proyecto desde cero.

Empieza ya. No dediques tiempo a branding, animaciones ni una estética avanzada. Prioriza lógica correcta, estructura mantenible, pruebas, datos y una experiencia móvil rápida.
