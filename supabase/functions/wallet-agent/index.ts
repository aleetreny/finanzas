// Single-payment browser interface for Instinct. The URL is a short-lived, one-time capability.
// No account passwords or broad permissions. Only an explicitly approved expense may be recorded.
import { createClient } from "npm:@supabase/supabase-js@2.110.5";

function htmlEscape(v: unknown): string {
  return String(v ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[c] || "");
}
const style = `
  :root{color-scheme:light;font-family:system-ui,-apple-system,sans-serif;color:#1d2530;background:#f4f5f7}
  *{box-sizing:border-box}body{margin:0;padding:32px 12px}
  main{background:white;max-width:540px;margin:0 auto;padding:28px;border-radius:18px;box-shadow:0 8px 35px #15243d14}
  h1{font-size:1.6rem;margin:0 0 12px}p{line-height:1.55;color:#4c5865}
  .payment{padding:16px;background:#f4f5f7;border-radius:12px;margin:20px 0}
  .amount{font-size:1.35rem;font-weight:750}small{display:block;color:#637182;margin-top:5px}
  label{display:block;font-weight:650;margin:16px 0 6px}
  input[type=text],select{width:100%;border:1px solid #a8b0bb;border-radius:10px;padding:12px;font:inherit}
  .check{display:flex;align-items:start;gap:10px;font-weight:450;line-height:1.5}
  button{background:#24365b;color:white;border:0;border-radius:10px;padding:13px 20px;font:inherit;font-weight:650;width:100%;margin-top:18px}
  .note{font-size:.84rem;color:#687381}.warning{color:#9d4123}
`;
function response(status: number, content: string) {
  return new Response(`<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Registrar gasto en Mis gastos</title><style>${style}</style></head><body><main>${content}</main></body></html>`, {
    status, headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store", "referrer-policy": "no-referrer",
      "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
      "x-content-type-options": "nosniff",
    },
  });
}
const info = (title: string, message: string, status = 200) => response(status,
  `<h1>${htmlEscape(title)}</h1><p>${htmlEscape(message)}</p>`);

async function tokenHash(token: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest)).map((x) => x.toString(16).padStart(2,"0")).join("");
}
function getAdmin() {
  const envKeys = Deno.env.get("SUPABASE_SECRET_KEYS");
  let key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (envKeys) {
    try { key = JSON.parse(envKeys).default || key; } catch { /* fallback */ }
  }
  const url = Deno.env.get("SUPABASE_URL");
  return url && key ? createClient(url,key,{auth:{persistSession:false}}) : null;
}
Deno.serve(async (req: Request) => {
  if (!["GET","POST"].includes(req.method)) return info("Método no permitido","Usa este enlace desde el correo.",405);
  const admin = getAdmin();
  if (!admin) return info("Servicio no disponible","Prueba más tarde.",503);

  const url = new URL(req.url);
  let token = url.searchParams.get("token") || "";
  let form: FormData | null = null;
  if (req.method === "POST") {
    if (Number(req.headers.get("content-length") || 0) > 8192) return info("Solicitud demasiado grande","",413);
    try { form = await req.formData(); } catch { return info("Formulario inválido","",400); }
    token = String(form.get("token") || "");
  }
  if (!/^[0-9a-f]{64}$/.test(token)) return info("Enlace inválido","Necesitas el enlace original del pago.",401);

  const { data: link, error: linkErr } = await admin.from("wallet_agent_links")
    .select("wallet_event_id,expires_at,used_at")
    .eq("token_hash",await tokenHash(token)).maybeSingle();
  if (linkErr) return info("No se pudo verificar el enlace","Prueba más tarde.",503);
  if (!link) return info("Enlace no válido","Solicita un nuevo enlace para este pago.",401);
  if (link.used_at) return info("Gasto ya registrado","Este enlace de un solo uso ya se utilizó.");
  if (new Date(link.expires_at).getTime() <= Date.now()) return info("Enlace caducado","El acceso a este pago ha expirado.",410);

  const { data: payment, error: paymentErr } = await admin.from("wallet_events")
    .select("id,user_id,merchant,amount_original,original_currency,amount_eur,paid_at,status")
    .eq("id",link.wallet_event_id).maybeSingle();
  if (paymentErr || !payment) return info("Pago no encontrado","No se ha podido cargar.",404);
  if (payment.status !== "pending") return info("Gasto ya gestionado","No se puede registrar dos veces.");

  if (req.method === "POST") {
    if (form?.get("confirmed") !== "yes") return info("Falta la confirmación","Debes confirmar antes que el propietario ha validado la categoría por WhatsApp.",400);
    const parts = String(form.get("category") || "").split("|");
    const category = parts[0] || "";
    const subcategory = parts[1] || null;
    const description = String(form.get("description") || payment.merchant).trim().slice(0,200);
    if (!/^[0-9a-f-]{36}$/.test(category) || (subcategory && !/^[0-9a-f-]{36}$/.test(subcategory))) {
      return info("Categoría inválida","Reabre el enlace e inténtalo.",400);
    }
    const { error } = await admin.rpc("record_wallet_event_from_agent", {
      p_token:token, p_category_id:category, p_subcategory_id:subcategory,
      p_description:description, p_remember:form.get("remember")==="yes" && payment.merchant!=="Comercio sin identificar",
    });
    if (error) {
      return info("No se ha podido registrar","Comprueba que el enlace no haya caducado y que la categoría exista. "+error.message,409);
    }
    return info("Gasto registrado","El pago se ha guardado en Mis gastos. No hagas ninguna operación adicional.");
  }

  const { data: cats, error: catsErr } = await admin.from("categories")
    .select("id,name").eq("user_id",payment.user_id)
    .eq("category_scope","expense").eq("is_active",true).order("sort_order");
  const { data: subs, error: subsErr } = await admin.from("subcategories")
    .select("id,category_id,name").eq("user_id",payment.user_id)
    .eq("is_active",true).order("sort_order");
  if (catsErr || subsErr || !cats?.length) return info("No hay categorías disponibles","No se puede clasificar este pago.",503);

  const optionItems = cats.flatMap((c) => [
    `<option value="${htmlEscape(c.id)}|">${htmlEscape(c.name)} (general)</option>`,
    ...(subs || []).filter(s=>s.category_id===c.id)
      .map(s=>`<option value="${htmlEscape(c.id)}|${htmlEscape(s.id)}">${htmlEscape(c.name)} → ${htmlEscape(s.name)}</option>`),
  ]).join("");

  const when = new Date(payment.paid_at).toLocaleString("es-ES",{
    timeZone:"Europe/London",dateStyle:"medium",timeStyle:"short",
  });
  return response(200,`<h1>Registrar gasto</h1>
    <p>Este enlace permite registrar <strong>solo este pago</strong>, no ver ni editar otras finanzas.</p>
    <div class="payment"><strong>${htmlEscape(payment.merchant)}</strong>
    <div class="amount">${htmlEscape(payment.amount_original)} ${htmlEscape(payment.original_currency)}</div>
    <small>${htmlEscape(when)} · ${payment.amount_eur == null ? "Conversión pendiente" : htmlEscape(payment.amount_eur)+" EUR (estimado)"}</small></div>
    <form method="post">
      <input type="hidden" name="token" value="${htmlEscape(token)}">
      <label for="description">Descripción del gasto</label>
      <input id="description" type="text" name="description" maxlength="200" required value="${htmlEscape(payment.merchant)}">
      <label for="category">Categoría y subcategoría</label>
      <select id="category" name="category" required><option value="">Seleccionar...</option>${optionItems}</select>
      ${payment.merchant==="Comercio sin identificar" ? "" : '<label class="check"><input type="checkbox" name="remember" value="yes"> Recordar este comercio para registrar futuros pagos automáticamente</label>'}
      <label class="check"><input type="checkbox" name="confirmed" value="yes" required> Ya he preguntado al propietario por WhatsApp y confirmado que este gasto y clasificación son correctos</label>
      <button type="submit" ${payment.amount_eur==null?"disabled":""}>Registrar este gasto</button>
      <p class="note">Solo se puede utilizar una vez. Caduca a las 48 horas.
      El importe en euros es provisional y puede diferir de la liquidación de Santander.</p>
      ${payment.amount_eur==null?'<p class="warning">Falta convertir GBP a EUR: primero reintenta la conversión en Mis gastos → Wallet.</p>':""}
    </form>`);
});
