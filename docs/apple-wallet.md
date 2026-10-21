# Apple Pay → Mis gastos (iPhone iOS 26)

Esta integración **no** requiere abrir sesión en Banco Santander, activar correos bancarios ni dar acceso a Apple Wallet a un agente externo.

## Estado y alcance

- Un pago **presencial con Apple Pay desde el iPhone** activa Atajos → llamada HTTPS → Edge Function en Supabase.
- Primera vez que aparece un comercio: **pendiente de revisar** en `/wallet`.
- Al confirmar el gasto y marcar *Recordar este comercio*, posteriores pagos del comercio se registran automáticamente con categoría, descripción y conversión de divisa.
- El importe en GBP se convierte a EUR usando la tasa diaria BCE obtenida por Frankfurter; se guarda también el importe GBP original en el registro del evento y en `transactions.import_metadata`. Esta conversión **no es la liquidación definitiva** de Santander.
- Funciona con EUR y GBP, pero se debe enviar correctamente `currency`.
- No capta gastos en efectivo, tarjeta física, Apple Watch ni todas las compras web/in-app en iOS 26.
- **Instinct/WhatsApp**: Instinct ha recibido un correo de prueba y ha contactado al propietario por WhatsApp, pero la grabación real de un gasto sigue pendiente de prueba. Para pagos desconocidos, el webhook devuelve un enlace de un solo gasto, caduca a las 48 horas, con formulario de clasificación y sin credenciales generales.
- Sin `event_id` en el atajo, el backend previene repeticiones idénticas con una ventana aproximada de 20 segundos. No cubre todos los reintentos; con UUID estable por evento la deduplicación es estricta.

## Configuración que realiza el propietario (una sola vez)

1. Abre https://aleetreny.github.io/finanzas/wallet/ e inicia sesión.
2. Pulsa «Generar clave para Atajos». Copia los 64 caracteres y no los compartas, ni publiques un atajo que incluya esa clave.
3. En el iPhone abre **Atajos → Automatización → + → Transacción / Wallet**. Selecciona la tarjeta Santander España y todas las categorías de comercios. Sin filtros. Marca **Ejecutar inmediatamente**, elige nueva automatización vacía.
4. Añade la acción **URL** con:
   `https://lshuotnvmxxvistppuzx.supabase.co/functions/v1/wallet-ingest`
5. Añade **Obtener contenido de URL**, método **POST**, cabecera `x-wallet-key` = clave copiada, cuerpo de la solicitud **JSON**:
   - `merchant` (texto): selecciona variable **Transacción/Entrada de atajo → Comercio** (Merchant). Hay que tocar la variable para cambiar el atributo.
   - `amount` (número o texto): **Transacción/Entrada de atajo → Importe** (Amount).
   - `currency` (texto): `GBP` cuando el importe está en libras; configura otra automatización específica o cambia a `EUR` si pagas en euros. El backend no puede inferir con seguridad la divisa por el país de la tarjeta.
   - `paid_at`: opcional; si no se envía utiliza la hora de recepción.
   - `event_id`: opcional; UUID por operación si dispones de una acción adecuada.
6. Opcionalmente después del POST añade **Mostrar notificación** (es notificación local, no correo).
7. Para comprobar conexión antes de gastar, crea temporalmente un **atajo manual de prueba** con el mismo POST JSON, con `merchant=TEST`, `amount=1`, `currency=GBP`, `dry_run=true`. El backend confirmará `dry_run=true`, sin anotar ningún gasto. **No incluyas `dry_run=true` en la automatización real.**
8. Tras pagar una vez con Apple Pay en tienda, visita la bandeja `/wallet/`; clasifica el pago y deja «Recordar» marcado. Los siguientes pagos en el mismo comercio se registrarán automáticamente.

Ejemplo de prueba (valores ficticios, nunca pegues claves en chats):

```json
{
  "merchant": "PRUEBA",
  "amount": 1,
  "currency": "GBP",
  "dry_run": true
}
```

## Seguridad

- `rotate_wallet_device_key()` emite una clave aleatoria criptográfica; en PostgreSQL se guarda únicamente `SHA-256` de la clave.
- `wallet_device_keys` no tiene acceso desde Data API para clientes anónimos/autenticados; solo un endpoint servidor con clave privada de Supabase puede verificar el hash. El navegador solo recibe el token recién emitido una vez.
- No se envían contraseñas, PAN, número de tarjeta ni credenciales de banco.
- Revocar la clave en `/wallet/` inutiliza el atajo hasta generar y configurar otra.
- Tabla de eventos y reglas con RLS de propietario. `record_wallet_event()` verifica dueño/categoría y realiza la creación contable y marcado de evento de manera transaccional.
- La llamada HTTP usa `x-wallet-key` y **nunca** una service key de Supabase en el teléfono.
- Si falla la tasa GBP→EUR, el evento queda pendiente con `amount_eur=null`. Usa «Reintentar conversión» en /wallet cuando vuelva a estar disponible la tasa. No se inventa un tipo de cambio.
- Un comerciante aprendido con auto-guardado nunca vuelve a consultar al usuario hasta que se quite/modifique la regla. Revisa los registros periódicamente.
- Dado que los apuntes históricos se guardan en EUR, las operaciones Wallet conservan GBP en metadata y el tipo de cambio en `fx_rate_date`. Si Santander liquida un importe distinto, concílialo manualmente.

## Desarrollo y despliegue

- Migración: `supabase/migrations/20261021201639_wallet_shortcuts_inbox.sql`
- Edge Function: `supabase/functions/wallet-ingest/index.ts`
- `supabase/config.toml`: `verify_jwt=false`, **pero el propio handler comprueba una clave de 256 bits** antes de cualquier operación.
- El frontend está exportado estáticamente por Next.js/GitHub Pages.
- No desplegar otra función con `verify_jwt=false` sin validación propia.
- Para pruebas, POST sin `x-wallet-key` debe devolver HTTP 401 y no crear registros.

## Puente autónomo con Instinct (prueba restringida)

Instinct del propietario: `aleinstinct@mail.instinct.com`.

Un pago desconocido procesado con `POST /functions/v1/wallet-ingest` devuelve `agent_url` (un enlace de un solo gasto). Si se ha registrado automáticamente como comercio aprendido, no devuelve `agent_url`. El link lleva un token aleatorio distinto de la clave del teléfono; caduca en **48 horas**, solo puede utilizarse **una vez** y no permite acceder al historial, banco ni otro gasto.

En Atajos, justo después de `Obtener contenido de URL`:

1. **Obtener valor de diccionario**: clave `agent_url` de la salida JSON.
2. **Si** el valor `agent_url` existe (es decir, el gasto quedó pendiente):
   - Acción **Enviar correo electrónico** de Apple Mail, para `aleinstinct@mail.instinct.com`.
   - Asunto: `Gasto de Apple Wallet por clasificar`.
   - Mensaje: `Nuevo gasto de Apple Wallet que he autorizado a clasificar. Antes de guardar, pregúntame por WhatsApp de qué es este cargo y espera mi confirmación. Después abre este enlace en tu navegador, clasifícalo con la información que te dé y pulsa Registrar. No registres nada sin mi respuesta. [agent_url]` (donde [agent_url] es la variable del atajo).
   - Desactivar **Mostrar hoja de redacción / Show Compose Sheet** para enviar sin abrir Mail. Debe existir una cuenta remitente configurada en la aplicación Apple Mail.
3. Fin de condición.

La web para Instinct es `/functions/v1/wallet-agent?token=<token>`: un formulario HTML con categoría/subcategoría, concepto, casilla para recordar y confirmación de haber hablado con el propietario. El agente podrá rellenarlo en un navegador si tiene acceso a esa función de Instinct; no hay garantía hasta probarlo de extremo a extremo.

No pongas la clave `x-wallet-key` de tu dispositivo en ningún email a Instinct. El enlace individual `agent_url` ya está restringido. El agente NO debe recibir la contraseña de Supabase ni Santander.

Para las pruebas reales, puedes dejar `remember` desmarcado. Si marcas recordar, siguientes compras de ese comercio se guardan automáticamente sin contactar por WhatsApp (cuando el endpoint ha podido aplicar la regla). El usuario puede desear que se le pregunte por todos los gastos: en ese caso habría que desactivar el auto-guardado por reglas.

**Limitaciones**: la app Mail ha de estar configurada para enviar desde Atajos. El evento Apple Pay en iOS 26 no cubre todos los pagos online ni los del Apple Watch. Si Instinct no consigue navegar el enlace, se necesitará cambiar la estrategia de interfaz o usar otra API verificada.
