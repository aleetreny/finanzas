# Enviar pagos a Instinct usando Gmail, sin dominio ni Apple Mail

Cuenta exclusiva: **alejandrotrenypagos@gmail.com**. Destinatario fijo: **aleinstinct@mail.instinct.com**.

El iPhone solo envía una petición HTTPS al Supabase de Mis gastos. Supabase comunica al script de Google de tu otra cuenta que tiene un pago desconocido y el script envía **desde su Gmail** un correo a Instinct. El envío no aparece en «Todos los enviados» de Apple Mail porque esta cuenta **no está añadida al iPhone/Mac Mail**.

## Configuración (sin proporcionar contraseñas ni claves a ChatGPT)

### 1. Crear el proyecto Google Apps Script

1. Abre https://script.google.com/home/projects/create e **inicia sesión con `alejandrotrenypagos@gmail.com`**. Comprueba el avatar superior derecho.
2. Renombra el proyecto como `Mis gastos - Instinct`.
3. Borra el contenido de `Code.gs` y pega todo el fichero [Code.gs](./Code.gs) de este repositorio.
4. Pulsa **Guardar**.

### 2. Crear una clave secreta de servidor (solo se muestra una vez)

1. En el desplegable de funciones (arriba, al lado de **Run**), selecciona `initializeBridge`.
2. Pulsa **Run** y autoriza la ejecución si Google lo pide.
3. En **Execution log** aparecerá una clave de 64 caracteres con el texto `WALLET_GAS_SHARED_SECRET`. **No la envíes a nadie, no la fotografíes, no la subas a GitHub ni la metas en el atajo del iPhone.**
4. Ve a https://supabase.com/dashboard/project/lshuotnvmxxvistppuzx/functions/secrets y añade:
   - **Name**: `WALLET_GAS_SHARED_SECRET`
   - **Value**: pega esa clave de 64 caracteres.
5. `initializeBridge` NO modifica una clave ya existente. Si pierdes la clave, necesitarás rotarla de forma controlada tanto en Google como en Supabase.

### 3. Permiso para enviar correos y publicación

1. En Apps Script, elige la función `authorizeMail` y pulsa **Run**. Aprueba el acceso a **enviar correos** desde esa cuenta. **No necesita permiso para leer el correo**.
2. Pulsa **Deploy → New deployment → Select type → Web app**.
3. **Execute as: Me (tu cuenta alejandrotrenypagos@gmail.com)**.
4. **Who has access: Anyone**. El endpoint es público, pero rechaza solicitudes sin la clave aleatoria correcta, y solo puede enviar a la dirección de Instinct.
5. Pulsa **Deploy**. Copia la **Web app URL**, que comienza por `https://script.google.com/macros/s/` y acaba en `/exec` (no uses una URL terminada en `/dev`).
6. En Supabase → Secrets añade:
   - **Name**: `WALLET_GAS_WEBAPP_URL`
   - **Value**: la URL completa del despliegue.

No hay que instalar ni añadir `alejandrotrenypagos@gmail.com` a la aplicación Apple Mail.

### 4. Probar

1. En Apps Script selecciona `sendTestToInstinct` y pulsa **Run**. Envía un **correo ficticio sin gasto real** solo a Instinct. Comprueba que Instinct lo reciba y te lo mencione por WhatsApp. Puedes verificar el envío desde la bandeja «Enviados» del Gmail secundario en el navegador.
2. Comprueba después una compra presencial real y pequeña con Apple Pay usando tu Shortcut actual (URL + Get Contents of URL). El backend debe responder `email_status: "accepted"`. Este estado significa que el script confirmó el envío, no que Instinct haya registrado el gasto.
3. Si confirmas que Instinct te escribe por WhatsApp, ya puedes editar el Atajo del iPhone y **eliminar** las acciones posteriores a `Get Contents of URL`: `Get Dictionary Value`, `If`, `Send Email`, `Otherwise`, `End If`. Mantén solo URL y POST. No hagas esto antes de probar la entrega desde Supabase.

## Privacidad y seguridad

- La clave `WALLET_GAS_SHARED_SECRET` se transmite únicamente de Supabase a Apps Script por HTTPS. No va en la web, Wallet, App Mail, el repositorio o en los mensajes a Instinct.
- Apps Script ejecuta como propietario y **solo** envía a `aleinstinct@mail.instinct.com`, no a direcciones indicadas por terceros.
- Verifica el dominio del enlace individual a la función `wallet-agent`, un token de 64 caracteres, ID de transacción, moneda e importe; rechaza cualquier petición no autenticada.
- LockService y propiedades de script evitan el reenvío de un mismo `event_id` tras una ejecución exitosa.
- Las notificaciones son solo para comercios desconocidos. Los ya aprendidos pueden registrarse automáticamente si lo autorizaste.
- App Script/Google Gmail tiene límite diario (actualmente 100 destinatarios/día en Gmail personal). Las cuotas pueden cambiar. Más que suficiente para los gastos normales.
- **Si Google Apps Script está inaccesible o falla**, el gasto permanece pendiente en `/wallet`. No se pierde aunque Instinct no reciba aviso.
- Gmail también guarda el correo en «Enviados» de la cuenta secundaria, pero **no** en la vista «Todos los enviados» de Apple Mail mientras esa cuenta permanezca fuera de Mail.

### Nota sobre Resend
`wallet-ingest` prefiere Google Apps Script cuando sus dos secretos están configurados. Si no lo están, mantiene el soporte anterior de Resend. En este caso **no hacen falta Resend ni un dominio de pago**.
