// Secure Apple Pay → Supabase bridge. No bank login or card number is required.
// The client key is minted in the app; its SHA-256 is stored in the database.
import { createClient } from "npm:@supabase/supabase-js@2.110.5";

type Payload = {
  event_id?: string;
  merchant?: string;
  amount?: number | string;
  currency?: string;
  paid_at?: string;
  dry_run?: boolean;
};
function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}
function normalizedMerchant(s: string) {
  return s.normalize("NFKC").toLocaleLowerCase("en-GB")
    .replace(/[^\p{L}\p{N}]+/gu, " ").trim().slice(0, 200);
}
function amountNumber(v: unknown) {
  if (typeof v !== "number" && typeof v !== "string") return NaN;
  const s = String(v).trim().replace(/^[£€\s]+/, "").replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return NaN;
  return Number(s);
}
async function tokenHash(key: string) {
  const bytes = new TextEncoder().encode(key);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash)).map((x) => x.toString(16).padStart(2, "0")).join("");
}
function londonDate(when: Date) {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(when);
}
async function convertToEur(amount: number, currency: string, date: string) {
  if (currency === "EUR") return { euros: amount, fxDate: date };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8500);
  try {
    const response = await fetch(
      `https://api.frankfurter.dev/v2/rate/GBP/EUR?providers=ecb&date=${encodeURIComponent(date)}`,
      { signal: controller.signal },
    );
    if (!response.ok) throw Error("Exchange rate unavailable");
    const data = await response.json();
    const rate = Number(data.rate);
    if (data.base !== "GBP" || data.quote !== "EUR" || !Number.isFinite(rate) || rate <= 0 ||
        !/^\d{4}-\d{2}-\d{2}$/.test(data.date) || data.date > date) throw Error("Invalid rate");
    return { euros: Math.round(amount * rate * 100) / 100, fxDate: data.date };
  } finally {
    clearTimeout(timer);
  }
}
Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json(405, { error: "Only POST is supported" });
  if (Number(req.headers.get("content-length") || 0) > 8192) return json(413, { error: "Payload too large" });

  const key = req.headers.get("x-wallet-key")?.trim() || "";
  if (!/^[0-9a-f]{64}$/.test(key)) return json(401, { error: "Invalid device key" });
  const envKeys = Deno.env.get("SUPABASE_SECRET_KEYS");
  const adminKey = (envKeys && JSON.parse(envKeys).default) || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const url = Deno.env.get("SUPABASE_URL");
  if (!adminKey || !url) return json(503, { error: "Service not configured" });
  const admin = createClient(url, adminKey, { auth: { persistSession: false } });

  const { data: owner, error: authError } = await admin.from("wallet_device_keys")
    .select("user_id").eq("token_hash", await tokenHash(key)).maybeSingle();
  if (authError) return json(503, { error: "Unable to validate device key" });
  if (!owner) return json(401, { error: "Invalid or revoked device key" });

  let input: Payload;
  try { input = await req.json(); }
  catch { return json(400, { error: "Invalid JSON" }); }
  const merchant = typeof input.merchant === "string" ? input.merchant.trim() : "";
  const merchantKey = normalizedMerchant(merchant);
  const amount = amountNumber(input.amount);
  const currency = (input.currency || "").trim().toUpperCase();
  const eventId = (input.event_id || crypto.randomUUID()).trim().toLowerCase();
  const paidAt = input.paid_at ? new Date(input.paid_at) : new Date();
  const validUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
  if (!validUuid.test(eventId)) return json(400, { error: "Invalid event_id UUID" });
  if (!merchantKey || merchant.length > 200 || !Number.isFinite(amount) || amount <= 0 ||
      amount >= 1e9 || !["GBP", "EUR"].includes(currency) || isNaN(paidAt.getTime()) ||
      paidAt.getTime() > Date.now() + 10 * 60_000 || paidAt.getTime() < Date.now() - 31 * 86400_000) {
    return json(400, { error: "Invalid merchant, amount, currency or payment date" });
  }
  // Native Shortcuts has no guaranteed built-in UUID action: use a short
  // best-effort duplicate window when the caller omits event_id.
  if (!input.event_id) {
    const { data: recent } = await admin.from("wallet_events")
      .select("id,status,amount_original,merchant_key,original_currency")
      .eq("user_id", owner.user_id)
      .eq("merchant_key", merchantKey)
      .eq("amount_original", amount)
      .eq("original_currency", currency)
      .gte("paid_at", new Date(paidAt.getTime() - 20_000).toISOString())
      .lte("paid_at", new Date(paidAt.getTime() + 20_000).toISOString())
      .limit(1);
    if (recent?.length) return json(200, {
      ok: true, duplicate: true, status: recent[0].status,
    });
  }
  const { data: existing } = await admin.from("wallet_events").select("id,status")
    .eq("user_id", owner.user_id).eq("source_event_id", eventId).maybeSingle();
  if (existing) return json(200, { ok: true, duplicate: true, status: existing.status });

  const date = londonDate(paidAt);
  let euros: number | null = null;
  let fxDate: string | null = null;
  try {
    const result = await convertToEur(amount, currency, date);
    euros = result.euros;
    fxDate = result.fxDate;
  } catch {
    // Never invent a GBP/EUR rate: leave in review inbox until conversion succeeds.
  }
  if (input.dry_run === true) {
    return json(200, { ok: true, dry_run: true, merchant, amount, currency, amount_eur: euros });
  }
  const { data: rule } = await admin.from("wallet_merchant_rules")
    .select("category_id,subcategory_id,label,auto_record")
    .eq("user_id", owner.user_id).eq("merchant_key", merchantKey).maybeSingle();

  const { data: event, error: insertError } = await admin.from("wallet_events")
    .insert({
      user_id: owner.user_id, source_event_id: eventId, merchant, merchant_key: merchantKey,
      amount_original: amount, original_currency: currency, paid_at: paidAt.toISOString(),
      amount_eur: euros, fx_rate_date: fxDate, status: "pending",
      suggested_category_id: rule?.category_id || null,
      suggested_subcategory_id: rule?.subcategory_id || null,
    }).select("id").single();
  if (insertError) {
    if (insertError.code === "23505") return json(200, { ok: true, duplicate: true });
    return json(503, { error: "Unable to save Wallet event" });
  }

  // Only auto-record a merchant that the owner has previously and explicitly approved.
  if (rule?.auto_record && euros != null && event) {
    const { data: accounts } = await admin.from("accounts")
      .select("id,is_default").eq("user_id", owner.user_id).order("is_default", { ascending: false }).limit(1);
    const account = accounts?.[0];
    if (account) {
      const { data: tx, error: txError } = await admin.from("transactions").insert({
        user_id: owner.user_id, account_id: account.id, transaction_date: date,
        name: rule.label || merchant, amount: -euros, direction: "expense",
        category_id: rule.category_id, subcategory_id: rule.subcategory_id || null,
        notes: `Apple Pay: ${amount} ${currency}; provisional, pending Santander reconciliation.`,
        source: "manual", source_external_id: `wallet:${eventId}`,
        import_metadata: {
          origin: "apple_wallet", wallet_event_id: event.id,
          amount_original: amount, currency, fx_rate_date: fxDate,
        },
      }).select("id").single();
      if (!txError && tx) {
        const { error: updateError } = await admin.from("wallet_events")
          .update({ status: "recorded", transaction_id: tx.id }).eq("id", event.id);
        if (updateError) console.error("Wallet transaction saved but event status update failed", event.id);
        return json(201, { ok: true, status: "recorded", transaction_id: tx.id });
      }
      console.error("Wallet automatic recording failed", txError?.code);
    }
  }
  return json(201, { ok: true, status: "pending", event_id: event.id, needs_review: true, amount_eur: euros });
});
