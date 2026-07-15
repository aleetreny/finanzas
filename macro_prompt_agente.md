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
- `platform`: `airbnb`, `booking`, `direct`, `other`
- fecha de reserva, entrada y salida opcionales
- `discount_amount`
- `cleaning_fee`
- `guest_paid_after_discount`
- `gross_before_discount`
- `platform_commission_rate`
- `platform_commission_amount`
- `bank_fee_rate`
- `bank_fee_amount`
- `manager_rate`
- `manager_commission_amount`
- `manager_cleaning_amount`
- `payout_received`
- `amount_payable_to_manager`
- `owner_net_after_manager`
- `calculation_status`
- `manual_override`
- `linked_transaction_id`
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
- Parking subarrendado
- Vivienda personal
- Comida
- Transporte
- Ocio
- Compras
- Suscripciones
- Salud
- Cuidado personal
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
5. Hay 1.068 movimientos.
6. No existen las dos filas vacías del CSV original.
7. Conserva `fila_original`, `categoria_original` y `nota_migracion` como metadatos o dentro de un JSON de importación si no quieres añadir columnas permanentes.
8. Muestra una vista previa antes de confirmar.
9. Informa de errores por fila sin cancelar todas las filas válidas.
10. No dupliques datos si se importa de nuevo.

No cambies fechas ni importes durante la importación.

## 9. Reglas del piso de Málaga

El contexto `Piso Málaga` debe permitir filtrar de forma independiente:

- Ingresos residenciales.
- Airbnb.
- Booking.
- Alquiler turístico directo u otra plataforma.
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

## 10. Calculadora de reservas de Airbnb

Usa estos valores predeterminados, todos editables:

- Limpieza: 60 €.
- Comisión de la gestora: 18 %.
- Comisión de Airbnb mostrada en el ejemplo: 15,5 % más IVA del 21 % sobre esa comisión.
- Tasa efectiva inicial de plataforma: `0.155 * 1.21 = 0.18755`.
- Sin gasto bancario separado en el ejemplo.

En Airbnb la plataforma descuenta automáticamente:

- Comisión de Airbnb.
- Limpieza para la gestora.
- Comisión de gestión.
- Descuentos.
- Pago al cohost.

La base de la comisión de gestión es:

`guest_paid_after_discount - platform_commission_amount - cleaning_fee`

La comisión de gestión es:

`manager_commission_amount = manager_rate * management_base`

El pago total al cohost es:

`manager_cleaning_amount + manager_commission_amount`

El ingreso del propietario es:

`payout_received = guest_paid_after_discount - platform_commission_amount - manager_cleaning_amount - manager_commission_amount`

Cuando el usuario introduzca únicamente el ingreso bancario recibido y el descuento, permite reconstruir una estimación:

`guest_paid_after_discount = (payout_received / (1 - manager_rate) + cleaning_fee) / (1 - effective_platform_rate)`

Después:

`gross_before_discount = guest_paid_after_discount + discount_amount`

Conserva precisión interna durante los cálculos y redondea a dos decimales al mostrar o guardar importes monetarios. Muestra una conciliación y, si la diferencia frente al pago real supera 0,02 €, exige ajuste manual.

### Caso de prueba Airbnb

Con el ejemplo aportado:

- Tarifa original de habitación: 1.489,00 €.
- Descuento: 148,90 €.
- Habitación tras descuento: 1.340,10 €.
- Limpieza: 60,00 €.
- Huésped paga: 1.400,10 €.
- Comisión Airbnb: 262,59 €.
- Base de la gestora: 1.077,51 €.
- Comisión del 18 %: 193,95 € aproximadamente.
- Pago total al cohost: 253,96 €.
- Ingreso recibido: 883,55 €.

El test debe aceptar diferencias de hasta dos céntimos por redondeos internos o por el modo en que la plataforma calcula el pago agregado al cohost.

## 11. Calculadora de reservas de Booking

Usa como valores predeterminados editables los que aparecen en el ejemplo:

- Limpieza: 70 €.
- Comisión Booking: 15 %.
- Cargo bancario: 1,3 %.
- Comisión de la gestora: 18 %.
- La factura de la gestora se calcula sin añadir IVA en esta primera configuración.

Booking ingresa en la cuenta del usuario:

`payout_received = guest_paid_after_discount - platform_commission_amount - bank_fee_amount`

La base de la gestora es:

`management_base = guest_paid_after_discount - platform_commission_amount - bank_fee_amount - cleaning_fee`

La comisión de la gestora es:

`manager_commission_amount = manager_rate * management_base`

La cantidad pendiente de pagar a la gestora es:

`amount_payable_to_manager = cleaning_fee + manager_commission_amount`

El neto final del propietario tras pagar a la gestora es:

`owner_net_after_manager = payout_received - amount_payable_to_manager`

Cuando el usuario introduzca el ingreso bancario y el descuento:

`guest_paid_after_discount = payout_received / (1 - booking_commission_rate - bank_fee_rate)`

`gross_before_discount = guest_paid_after_discount + discount_amount`

Todas las variables deben ser editables por reserva.

### Caso de prueba Booking

Con el ejemplo aportado:

- Total de la reserva: 327,40 €.
- Comisión Booking: 49,11 €.
- Cargo bancario: 4,26 €.
- Cobro de Booking: 274,03 €.
- Limpieza: 70,00 €.
- Base de la gestora: 204,03 €.
- Comisión del 18 %: 36,73 €.
- Pago a la gestora: 106,73 €.
- Neto final del propietario: 167,30 €.

## 12. Tratamiento del histórico de Airbnb y Booking

No inventes desgloses para los cobros históricos.

Los movimientos históricos contienen principalmente el importe bancario neto, pero no todos los descuentos ni todos los datos de la reserva. Por tanto:

- Impórtalos como movimientos reales.
- Marca la plataforma.
- No generes comisiones históricas ficticias.
- Permite vincular más adelante una reserva o factura si el usuario la añade.
- Usa la calculadora completa para las reservas nuevas.

## 13. Movimientos recurrentes

Importa `recurrentes_iniciales.csv`.

Crea inicialmente:

- Ingreso del parking: +130 € mensuales.
- Coste del parking: -95 € mensuales desde agosto de 2026.

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
   - ingresos y gastos
   - resultado neto
   - filtros por plataforma y ejercicio
   - posibles gastos fiscales
   - candidatos a inmovilizado

5. `/reservas`
   - listado
   - alta Airbnb
   - alta Booking
   - desglose y conciliación

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
   - porcentajes predeterminados
   - limpieza Airbnb/Booking
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
- Resultado del parking.
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

- Tests unitarios de los dos ejemplos de Airbnb y Booking.
- Test de importación de 1.068 filas.
- Test de idempotencia del CSV.
- Test de generación de recurrentes sin duplicados.
- Test de cambio de vigencia del parking.
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
- Importar y validar los 1.068 movimientos.
- CRUD de movimientos.

### Fase 3
- Recurrentes y parking.
- Calculadoras Airbnb y Booking con tests.

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
- El histórico contiene exactamente 1.068 movimientos sin duplicados.
- La suma total de importes coincide con 15.296,66 €.
- Se puede añadir, editar y eliminar un movimiento desde móvil y escritorio.
- Las categorías coinciden con el catálogo.
- El parking genera +130 € y -95 € desde agosto de 2026 sin duplicados.
- Los ejemplos de Airbnb y Booking cuadran dentro de 0,02 €.
- El piso de Málaga tiene una vista separada.
- Los candidatos a inmovilizado se pueden revisar.
- La aplicación es instalable como PWA.
- RLS impide acceder a datos de otro usuario.
- Existe exportación CSV completa.
- El README permite ejecutar el proyecto desde cero.

Empieza ya. No dediques tiempo a branding, animaciones ni una estética avanzada. Prioriza lógica correcta, estructura mantenible, pruebas, datos y una experiencia móvil rápida.
