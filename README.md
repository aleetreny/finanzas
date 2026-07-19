# Finanzas personales

Aplicación responsive y PWA para gestionar el histórico financiero personal y, en una pestaña independiente, el Piso Málaga. Usa Next.js con exportación estática para GitHub Pages y Supabase para autenticación, base de datos y RLS.

## Entornos

- Web: [aleetreny.github.io/finanzas](https://aleetreny.github.io/finanzas/)
- Código: [github.com/aleetreny/finanzas](https://github.com/aleetreny/finanzas) (repositorio privado)
- Supabase: proyecto `Finanzas`, región París (`eu-west-3`), referencia `lshuotnvmxxvistppuzx`

## Datos incluidos

- `movimientos_financieros_corregidos.csv`: 1.024 movimientos históricos, suma auditada de **14.276,66 €**.
- `catalogo_categorias.csv`: 12 categorías y 71 combinaciones categoría/subcategoría.
- `recurrentes_iniciales.csv`: catálogo vacío, listo para añadir reglas recurrentes futuras.
- `macro_prompt_agente.md`: especificación funcional original.

Los importes y fechas de los movimientos conservados no se modifican. Los gastos de cuidado personal están migrados a `Salud / Cuidado personal`; `Noel +500 €` se conserva como reembolso y los cobros de Airbnb y Booking se guardan como importes bancarios reales sin inventar desgloses.

## Funcionalidad

- Dashboard personal sin mezclar los movimientos del Piso Málaga.
- Alta rápida, edición, eliminación, búsqueda y filtros de movimientos.
- Vista independiente del Piso Málaga y candidatos a inmovilizado.
- Calculadoras conciliadas de Airbnb y Booking.
- Reglas recurrentes idempotentes y vigencias futuras.
- Calculadora de amortización lineal prorrateada por días.
- Importación CSV con vista previa, hash e informe por fila; exportación completa.
- CRUD completo de categorías y subcategorías, con ámbitos separados para gastos, ingresos y Piso Málaga.
- Autenticación por enlace mágico, PWA instalable y diseño móvil.

## Desarrollo local

Requisitos: Node.js 24 y npm.

```bash
npm ci
Copy-Item .env.example .env.local
npm run dev
```

Configura en `.env.local`:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

La clave publicable está diseñada para el navegador y queda protegida por RLS. No añadas una `service_role` ni una clave secreta al cliente.

## Base de datos y migraciones

Las migraciones versionadas están en `supabase/migrations`:

1. `initial_schema`: tablas, restricciones, índices, triggers, grants y políticas RLS.
2. `initial_data`: cuenta principal, Piso Málaga, taxonomía y 1.024 movimientos.
3. `harden_security_and_indexes`: permisos mínimos, función de reclamación restringida e índices de claves foráneas.
4. `reorganize_finance_categories`: separación por ámbitos, migración de cuidado personal y retirada del dominio eliminado.

El dataset inicial se inserta sin propietario y no es visible mediante la Data API. Tras el primer inicio de sesión, `claim_initial_dataset()` lo asigna atómicamente a ese usuario. La función solo puede ejecutarla el rol `authenticated`, valida `auth.uid()` y no permite que otro usuario reclame el histórico.

Para regenerar la migración de datos desde los CSV:

```bash
npm run seed:generate
```

Para crear nuevas migraciones usa siempre la CLI:

```bash
npx supabase migration new nombre_descriptivo
```

## Validación

```bash
npm run lint
npm run typecheck
npm run test
npm run build
npx playwright test
```

Los tests cubren los ejemplos de Airbnb y Booking, las 1.024 filas y su suma, idempotencia, separación del Piso Málaga, taxonomía, amortización y presencia de RLS.

## Despliegue en GitHub Pages

El workflow `.github/workflows/deploy-pages.yml` valida y genera el export estático `out/`. En el repositorio configura estos secretos:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

Después activa **Settings → Pages → Source: GitHub Actions**. Cada `push` a `main` ejecuta pruebas, compila y publica.

## Decisiones de integridad

- El histórico importado es idempotente por `source_external_id` y lote/hash.
- Los importes conservan su signo y una restricción lo hace coherente con `direction`.
- Los cambios recurrentes usan nuevas vigencias; no reescriben meses anteriores.
- Aire acondicionado y cerradura son candidatos a revisión, no amortizaciones automáticas.
- Las etiquetas fiscales ayudan a organizar y revisar, pero no sustituyen validación tributaria profesional.
