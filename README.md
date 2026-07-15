# Finanzas personales

Aplicación responsive y PWA para gestionar el histórico financiero personal, el Piso Málaga, el parking subarrendado, reservas turísticas e inmovilizado. Usa Next.js con exportación estática para GitHub Pages y Supabase para autenticación, base de datos y RLS.

## Datos incluidos

- `movimientos_financieros_corregidos.csv`: 1.068 movimientos históricos, suma auditada de **15.296,66 €**.
- `catalogo_categorias.csv`: 14 categorías y 73 combinaciones categoría/subcategoría.
- `recurrentes_iniciales.csv`: ingreso mensual de parking de +130 € y coste mensual de -95 € desde agosto de 2026.
- `macro_prompt_agente.md`: especificación funcional original.

Los importes y fechas históricos no se modifican. `Noel +500 €` se conserva como reembolso; los cobros de Airbnb y Booking se guardan como importes bancarios reales sin inventar desgloses.

## Funcionalidad

- Dashboard con ingresos, gastos, saldo, evolución mensual y categorías.
- Alta rápida, edición, eliminación, búsqueda y filtros de movimientos.
- Vista independiente del Piso Málaga y candidatos a inmovilizado.
- Calculadoras conciliadas de Airbnb y Booking.
- Reglas recurrentes idempotentes y vigencias futuras.
- Calculadora de amortización lineal prorrateada por días.
- Importación CSV con vista previa, hash e informe por fila; exportación completa.
- Categorías, subcategorías y porcentajes configurables.
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
2. `initial_data`: cuenta principal, Piso Málaga, taxonomía, recurrentes y 1.068 movimientos.

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

Los tests cubren los ejemplos de Airbnb y Booking, 1.068 filas y su suma, idempotencia, vigencia del parking, amortización y presencia de RLS.

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
