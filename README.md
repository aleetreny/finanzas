# Finanzas personales

Aplicación responsive y PWA para gestionar el histórico financiero personal y, en una pestaña independiente, el Piso Málaga. Usa Next.js con exportación estática para GitHub Pages y Supabase para autenticación, base de datos y RLS. Esta instalación es personal: solo admite el acceso del propietario mediante correo y clave.

## Entornos

- Web: [aleetreny.github.io/finanzas](https://aleetreny.github.io/finanzas/)
- Código: [github.com/aleetreny/finanzas](https://github.com/aleetreny/finanzas) (repositorio privado)
- Supabase: proyecto `Finanzas`, región París (`eu-west-3`), referencia `lshuotnvmxxvistppuzx`

## Datos incluidos

- `movimientos_financieros_corregidos.csv`: 1.024 movimientos históricos, suma auditada de **14.276,66 €**.
- `catalogo_categorias.csv`: 12 categorías y 68 combinaciones categoría/subcategoría.
- `recurrentes_iniciales.csv`: catálogo vacío, listo para añadir reglas recurrentes futuras.
- `macro_prompt_agente.md`: especificación funcional original.

Los importes y fechas de los movimientos conservados no se modifican. Los gastos de cuidado personal están migrados a `Salud / Cuidado personal`; `Noel +500 €` se conserva como reembolso. Desde julio de 2026 los cobros del piso se convierten en reservas editables y quedan marcados para completar su desglose, sin inventar comisiones.

## Funcionalidad

- Dashboard personal sin mezclar los movimientos del Piso Málaga.
- Alta rápida, edición, eliminación, búsqueda y filtros de movimientos.
- Aviso de posible duplicado: si un gasto nuevo coincide en importe y categoría con alguno de los diez últimos anotados, se muestra cuál es y se pide confirmación antes de guardarlo.
- Vista independiente del Piso Málaga con un formulario compacto de reservas, noches automáticas y perfiles de comisión para Airbnb antigua/nueva, Booking, Directa y Otra.
- Cada reserva conserva su modelo y porcentajes; las comisiones reales de plataforma y gestora pueden sobrescribir el cálculo automático sin perder diferencias de redondeo.
- Prorrateo diario o mensual de cada reserva, resumen mensual, neto acumulado y cuadro fiscal anual.
- Un único tipo de ingreso por alquiler, sin separar plataformas ni modalidad residencial/turística.
- CRUD de gastos periódicos del piso con vigencias mensual, trimestral o anual.
- Calculadora de amortización lineal prorrateada por días.
- Importación CSV con vista previa, hash e informe por fila; exportación completa.
- CRUD completo de categorías y subcategorías, con ámbitos separados para gastos, ingresos y Piso Málaga.
- Autenticación por correo y clave, PWA instalable y diseño móvil.
- Sin registro público, invitaciones ni correos de acceso.

## Cuentas de usuario

La web pública es solo la interfaz de tu libreta; no permite crear cuentas ni recuperar claves por correo. Puedes entrar desde cualquier dispositivo con el mismo correo y clave.

1. En un dispositivo donde ya tengas la sesión abierta, ve a **Ajustes → Tu clave de acceso** y establece o cambia una clave de al menos 10 caracteres.
2. En el móvil u ordenador nuevo, abre la web e inicia sesión con ese mismo correo y clave.
3. La PWA guarda la sesión en cada dispositivo de forma independiente.

Guarda la clave en un gestor de contraseñas: al no haber recuperación por correo, no hay un acceso alternativo público.

La función `bootstrap_user_workspace()` se conserva para completar de forma idempotente el espacio del propietario cuando inicia sesión, sin crear otros usuarios ni modificar el histórico.

## Crear una instalación propia

Quien quiera usar la aplicación debe clonar el repositorio y conectarlo a su propio proyecto de Supabase; nunca debe reutilizar este proyecto ni sus credenciales.

1. Crea un proyecto de Supabase y aplica las migraciones del repositorio con la CLI.
2. En **Authentication → Users**, crea manualmente un único usuario propietario con correo y clave y confírmalo.
3. Mantén desactivado el registro en **Authentication → Sign In / Providers**. El `supabase/config.toml` del repositorio ya lo deja desactivado para entornos nuevos y la migración añade una segunda barrera: solo permite el primer propietario creado manualmente.
4. Configura en su clon las variables públicas de Supabase y los secretos de GitHub Pages indicados más abajo.

No hace falta configurar SMTP: esta versión no envía correos de acceso.

## Instalar en el móvil

La web publicada funciona como una aplicación independiente y necesita servirse por HTTPS (GitHub Pages ya lo hace):

- **iPhone/iPad:** abre la web en Safari, pulsa **Compartir** y elige **Añadir a pantalla de inicio**.
- **Android:** abre la web en Chrome, pulsa el menú de tres puntos y elige **Instalar aplicación** o **Añadir a pantalla de inicio**.

Al abrirla desde el icono se muestra sin la barra del navegador. La navegación inferior mantiene **Anotar** siempre a mano; en Android, una pulsación larga sobre el icono también ofrece el acceso rápido **Anotar un gasto**.

En iPhone, Safari y una PWA instalada no siempre comparten sesión. La primera vez:

1. Antes de instalarla, asegúrate de tener una clave guardada en **Ajustes → Tu clave de acceso**.
2. Abre **Mis gastos** desde su icono.
3. Entra con el mismo correo y clave. La sesión queda guardada en la PWA y no es necesario repetir el proceso en cada apertura.

## Desarrollo local

Requisitos: Node.js 24 y npm.

```bash
npm ci
cp .env.example .env.local
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
5. `property_rental_dashboard`: reservas canónicas, unificación del ingreso del piso, alquiler enero-junio de 7.200 €, cobros de julio editables y comunidad periódica desde agosto.
6. `rental_commission_models`: fecha de salida exclusiva, alojamiento final, perfiles de comisión inmutables por reserva y overrides de importes reales.
7. `multi_user_onboarding`: función `bootstrap_user_workspace()` idempotente para completar el espacio del propietario.
8. `retire_public_signup`: retirada de la función pública de invitaciones, conservando sus registros técnicos históricos sin acceso.
9. `harden_owner_account_guard`: cerrojo transaccional que impide crear una segunda cuenta de propietario.

El dataset inicial se inserta sin propietario y no es visible mediante la Data API. Tras el primer inicio de sesión del usuario propietario creado manualmente, `claim_initial_dataset()` lo asigna atómicamente a ese usuario. La función solo puede ejecutarla el rol `authenticated` y valida `auth.uid()`.

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

Los tests cubren las 1.024 filas y su suma, idempotencia, separación del Piso Málaga, prorrateo de reservas, perfiles y overrides de comisión, gastos periódicos, taxonomía, amortización, detección de gastos duplicados y presencia de RLS.

## Despliegue en GitHub Pages

El workflow `.github/workflows/deploy-pages.yml` valida y genera el export estático `out/`. En el repositorio configura estos secretos:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

Después activa **Settings → Pages → Source: GitHub Actions**. Cada `push` a `main` ejecuta pruebas, compila y publica.

En el proyecto de Supabase asociado a ese clon, deja desactivado el registro de nuevos usuarios y crea el propietario manualmente desde el panel de Authentication antes de abrir la web.

## Decisiones de integridad

- El histórico importado es idempotente por `source_external_id` y lote/hash.
- Los importes conservan su signo y una restricción lo hace coherente con `direction`.
- Los cambios recurrentes usan nuevas vigencias; no reescriben meses anteriores.
- Aire acondicionado y cerradura son candidatos a revisión, no amortizaciones automáticas.
- Las etiquetas fiscales ayudan a organizar y revisar, pero no sustituyen validación tributaria profesional.
