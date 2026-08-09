# Finanzas personales

Aplicación responsive y PWA para gestionar el histórico financiero personal y, en una pestaña independiente, el Piso Málaga. Usa Next.js con exportación estática para GitHub Pages y Supabase para autenticación, base de datos y RLS. Es multiusuario: cualquier persona puede crear su cuenta y obtiene su propia libreta, completamente aislada del resto.

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
- Vista independiente del Piso Málaga con un formulario compacto de reservas, noches automáticas y perfiles de comisión para Airbnb antigua/nueva, Booking, Directa y Otra.
- Cada reserva conserva su modelo y porcentajes; las comisiones reales de plataforma y gestora pueden sobrescribir el cálculo automático sin perder diferencias de redondeo.
- Prorrateo diario o mensual de cada reserva, resumen mensual, neto acumulado y cuadro fiscal anual.
- Un único tipo de ingreso por alquiler, sin separar plataformas ni modalidad residencial/turística.
- CRUD de gastos periódicos del piso con vigencias mensual, trimestral o anual.
- Calculadora de amortización lineal prorrateada por días.
- Importación CSV con vista previa, hash e informe por fila; exportación completa.
- CRUD completo de categorías y subcategorías, con ámbitos separados para gastos, ingresos y Piso Málaga.
- Autenticación por enlace mágico o correo y clave, PWA instalable y diseño móvil.
- Registro abierto: cada usuario nuevo recibe automáticamente su espacio de trabajo.

## Cuentas de usuario

Cualquier persona puede usar la aplicación, no solo el propietario del histórico:

1. En la pantalla de acceso, pulsa **Crear una cuenta nueva** y escribe tu correo.
2. Abre el enlace recibido; se creará tu cuenta y llegarás a **Ajustes → Tu clave de acceso**.
3. A partir de ahí se entra con correo y clave desde cualquier dispositivo.

Si ya tenías cuenta pero no recuerdas la clave, pulsa **He olvidado mi clave**. Ese enlace no crea una cuenta nueva: solo permite recuperar una cuenta existente.

En el primer inicio de sesión, la función `bootstrap_user_workspace()` aprovisiona el espacio de trabajo del usuario: una cuenta bancaria por defecto, la taxonomía inicial de categorías y subcategorías, una propiedad para la pestaña de alquiler y sus ajustes. El histórico original solo pertenece al primer usuario que lo reclamó; las políticas RLS garantizan que nadie ve datos de otra persona.

El proveedor de correo integrado de Supabase solo entrega mensajes a direcciones autorizadas de la organización y tiene límites estrictos. Para que los enlaces lleguen a otras personas, configura un SMTP propio en el panel de Supabase (**Authentication → Emails → SMTP settings**).

## Instalar en el móvil

La web publicada funciona como una aplicación independiente y necesita servirse por HTTPS (GitHub Pages ya lo hace):

- **iPhone/iPad:** abre la web en Safari, pulsa **Compartir** y elige **Añadir a pantalla de inicio**.
- **Android:** abre la web en Chrome, pulsa el menú de tres puntos y elige **Instalar aplicación** o **Añadir a pantalla de inicio**.

Al abrirla desde el icono se muestra sin la barra del navegador. La navegación inferior mantiene **Anotar** siempre a mano; en Android, una pulsación larga sobre el icono también ofrece el acceso rápido **Anotar un gasto**.

En iPhone, Safari y una PWA instalada no siempre comparten la sesión creada por un enlace mágico. La primera vez:

1. En la aplicación instalada, pulsa **Crear una cuenta nueva** y solicita el correo.
2. Abre el enlace recibido en el mismo navegador; te llevará directamente a **Ajustes → Tu clave de acceso**.
3. Crea una clave de al menos 10 caracteres y vuelve a abrir **Mis gastos** desde su icono.
4. Entra con el mismo correo y esa clave. La sesión queda guardada en la PWA y no es necesario repetir el proceso en cada apertura.

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
5. `property_rental_dashboard`: reservas canónicas, unificación del ingreso del piso, alquiler enero-junio de 7.200 €, cobros de julio editables y comunidad periódica desde agosto.
6. `rental_commission_models`: fecha de salida exclusiva, alojamiento final, perfiles de comisión inmutables por reserva y overrides de importes reales.
7. `multi_user_onboarding`: función `bootstrap_user_workspace()` que aprovisiona cuenta, taxonomía y propiedad a cada usuario nuevo de forma idempotente.

El dataset inicial se inserta sin propietario y no es visible mediante la Data API. Tras el primer inicio de sesión, `claim_initial_dataset()` lo asigna atómicamente a ese usuario. La función solo puede ejecutarla el rol `authenticated`, valida `auth.uid()` y no permite que otro usuario reclame el histórico. El resto de usuarios pasa por `bootstrap_user_workspace()`, que respeta esa reclamación única y siembra un espacio de trabajo vacío listo para anotar.

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

Los tests cubren las 1.024 filas y su suma, idempotencia, separación del Piso Málaga, prorrateo de reservas, perfiles y overrides de comisión, gastos periódicos, taxonomía, amortización y presencia de RLS.

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
