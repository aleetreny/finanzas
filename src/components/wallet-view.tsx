"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { useFinance } from "@/components/finance-provider";
import { getSupabase } from "@/lib/supabase";

type WalletEvent = {
  id: string;
  merchant: string;
  amount_original: number;
  original_currency: string;
  paid_at: string;
  amount_eur: number | null;
  status: "pending" | "recorded" | "ignored";
  suggested_category_id: string | null;
  suggested_subcategory_id: string | null;
  notes: string | null;
};

const endpoint = "https://lshuotnvmxxvistppuzx.supabase.co/functions/v1/wallet-ingest";

function PendingPayment({
  payment, done,
}: {
  payment: WalletEvent;
  done: () => Promise<void>;
}) {
  const { categories, subcategories, refresh } = useFinance();
  const [name, setName] = useState(payment.merchant);
  const [category, setCategory] = useState(payment.suggested_category_id || "");
  const [subcategory, setSubcategory] = useState(payment.suggested_subcategory_id || "");
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const availableCategories = categories.filter((entry) => entry.category_scope === "expense" && entry.is_active);
  const availableSubcats = subcategories.filter((item) => item.category_id === category && item.is_active);

  async function confirm() {
    const supabase = getSupabase();
    if (!supabase || !category) return;
    setBusy(true);
    setError(null);
    const { error: rpcError } = await supabase.rpc("record_wallet_event", {
      p_event_id: payment.id, p_category_id: category,
      p_subcategory_id: subcategory || null,
      p_description: name.trim() || payment.merchant, p_remember: remember,
    });
    if (rpcError) setError(rpcError.message);
    else {
      await Promise.all([done(), refresh()]);
    }
    setBusy(false);
  }

  async function ignore() {
    const supabase = getSupabase();
    if (!supabase || !window.confirm("¿Descartar este pago de Wallet?")) return;
    setBusy(true);
    const { error: updateError } = await supabase.from("wallet_events")
      .update({ status: "ignored" }).eq("id", payment.id);
    if (updateError) setError(updateError.message);
    else await done();
    setBusy(false);
  }
  return (
    <article className="wallet-payment">
      <div className="wallet-payment-head">
        <div>
          <strong>{payment.merchant}</strong>
          <p>{new Date(payment.paid_at).toLocaleString("es-ES", { dateStyle: "medium", timeStyle: "short" })}</p>
        </div>
        <div className="wallet-price">
          <strong>{Number(payment.amount_original).toFixed(2)} {payment.original_currency}</strong>
          <span>{payment.amount_eur === null ? "Cambio no disponible" : Number(payment.amount_eur).toFixed(2) + " € provisional"}</span>
        </div>
      </div>
      <div className="wallet-fields">
        <label>Concepto
          <input value={name} maxLength={200} onChange={(event) => setName(event.target.value)} />
        </label>
        <label>Categoría
          <select value={category} onChange={(event) => { setCategory(event.target.value); setSubcategory(""); }}>
            <option value="">Selecciona categoría</option>
            {availableCategories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </label>
        <label>Subcategoría
          <select value={subcategory} onChange={(event) => setSubcategory(event.target.value)}>
            <option value="">Sin subcategoría</option>
            {availableSubcats.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </label>
      </div>
      <label className="wallet-remember">
        <input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} />
        Recordar este comercio: registrar automáticamente futuros pagos similares
      </label>
      <div className="wallet-actions">
        <button className="button primary" type="button" onClick={() => void confirm()}
          disabled={busy || !category || payment.amount_eur === null}>Registrar gasto</button>
        <button className="button" type="button" onClick={() => void ignore()} disabled={busy}>Ignorar</button>
      </div>
      {error && <p className="notice error" role="alert">{error}</p>}
    </article>
  );
}

export function WalletView() {
  const { session } = useFinance();
  const [payments, setPayments] = useState<WalletEvent[]>([]);
  const [busy, setBusy] = useState(false);
  const [oneTimeToken, setOneTimeToken] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    const supabase = getSupabase();
    if (!supabase || !session) return;
    setLoading(true);
    const { data, error } = await supabase.from("wallet_events").select(
      "id,merchant,amount_original,original_currency,paid_at,amount_eur,status,suggested_category_id,suggested_subcategory_id,notes",
    ).eq("status", "pending").order("paid_at", { ascending: false }).limit(60);
    if (error) setFeedback(error.message);
    else setPayments((data || []) as WalletEvent[]);
    setLoading(false);
  }, [session]);

  useEffect(() => { void Promise.resolve().then(load); }, [load]);

  async function rotateKey() {
    const supabase = getSupabase();
    if (!supabase || !window.confirm("¿Crear una nueva clave para Atajos? La anterior dejará de funcionar.")) return;
    setBusy(true);
    setFeedback(null);
    const { data, error } = await supabase.rpc("rotate_wallet_device_key");
    if (error) setFeedback(error.message);
    else { setOneTimeToken(String(data)); setFeedback("Copia esta clave a Atajos. Solo se mostrará una vez."); }
    setBusy(false);
  }

  async function revokeKey() {
    const supabase = getSupabase();
    if (!supabase || !window.confirm("¿Desconectar el iPhone? Dejará de poder enviar pagos.")) return;
    setBusy(true);
    const { error } = await supabase.rpc("revoke_wallet_device_key");
    setFeedback(error ? error.message : "Clave revocada. El iPhone ya no podrá enviar cargos.");
    setOneTimeToken("");
    setBusy(false);
  }

  return (
    <div className="page wallet-page">
      <PageHeader eyebrow="Integraciones" title="Apple Wallet"
        description="Pagos capturados desde el iPhone. Los comercios aprendidos se contabilizan solos; revisa aquí los demás." />
      <section className="wallet-setup">
        <h2>Conecta tu iPhone</h2>
        <p>La conexión utiliza un token exclusivo revocable. No compartas contraseñas ni datos de Santander.</p>
        <div className="wallet-actions">
          <button type="button" className="button primary" onClick={() => void rotateKey()} disabled={busy}>Generar clave para Atajos</button>
          <button type="button" className="button" onClick={() => void revokeKey()} disabled={busy}>Revocar clave</button>
        </div>
        {oneTimeToken && <div className="wallet-token">
          <p><strong>Clave secreta (solo visible ahora):</strong></p>
          <code>{oneTimeToken}</code>
          <button type="button" className="button" onClick={() => void navigator.clipboard.writeText(oneTimeToken)}>Copiar clave</button>
          <p>Una vez copiada, sal de esta página. Si pierdes la clave, genera una nueva y actualiza Atajos.</p>
        </div>}
        <details className="wallet-guide">
          <summary>Ver instrucciones para Atajos (iOS 26)</summary>
          <ol>
            <li>En Atajos → Automatización → + → Transacción / Wallet, selecciona tu Santander.</li>
            <li>Activa «Ejecutar inmediatamente» y elige «Nueva automatización vacía».</li>
            <li>Obtén «Importe» y «Comercio» de la variable «Entrada de atajo» / «Transacción».</li>
            <li>Añade «Obtener contenido de URL», método POST, cuerpo JSON con merchant, amount y currency=GBP. Si quieres usar un UUID opcional, añade event_id.</li>
            <li>URL: <code>{endpoint}</code>. Cabecera <code>x-wallet-key</code>: pega tu clave secreta.</li>
            <li>Haz una prueba controlada y revisa que el gasto aparece aquí. Cambia la moneda a EUR cuando proceda.</li>
          </ol>
        </details>
        <p className="wallet-caveat">iOS 26 detecta pagos presenciales con el iPhone, no todas las compras online ni pagos con el reloj. La conversión BCE es provisional hasta la liquidación de Santander.</p>
      </section>
      <section className="wallet-inbox">
        <div className="wallet-section-head">
          <h2>Pendientes de clasificar ({payments.length})</h2>
          <button className="button" type="button" onClick={() => void load()} disabled={loading}>Actualizar</button>
        </div>
        {loading && <p>Cargando movimientos…</p>}
        {!loading && payments.length === 0 && <p>No hay pagos pendientes. Aparecerán aquí cuando hagas uno con Apple Pay.</p>}
        {payments.map((payment) =>
          <PendingPayment key={payment.id} payment={payment} done={load} />
        )}
      </section>
      {feedback && <p role="status" className="notice">{feedback}</p>}
    </div>
  );
}
