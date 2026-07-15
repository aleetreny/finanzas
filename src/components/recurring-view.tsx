"use client";

import { CalendarCheck, LoaderCircle, Pause, Play } from "lucide-react";
import { useMemo, useState } from "react";
import { useFinance } from "@/components/finance-provider";
import { PageHeader } from "@/components/page-header";
import { formatCurrency, formatDate, todayIso } from "@/lib/format";
import { pendingMonthlyOccurrences } from "@/lib/recurring";
import { getSupabase } from "@/lib/supabase";
import type { RecurringRule } from "@/lib/types";

function horizonIso() {
  const date = new Date();
  date.setUTCMonth(date.getUTCMonth() + 4);
  return date.toISOString().slice(0, 10);
}

export function RecurringView() {
  const { recurringRules, transactions, accounts, session, refresh } = useFinance();
  const [working, setWorking] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const supabase = getSupabase();
  const plans = useMemo(() => recurringRules.map((rule) => ({
    rule,
    upcoming: pendingMonthlyOccurrences(rule, transactions, horizonIso()),
    due: pendingMonthlyOccurrences(rule, transactions, todayIso()),
  })), [recurringRules, transactions]);
  const monthlyNet = recurringRules.filter((rule) => rule.is_active && rule.frequency === "monthly").reduce((sum, rule) => sum + Number(rule.amount), 0);

  async function toggle(rule: RecurringRule) {
    if (!supabase) return;
    setWorking(rule.id); setMessage(null);
    const { error } = await supabase.from("recurring_rules").update({ is_active: !rule.is_active }).eq("id", rule.id);
    setWorking(null);
    if (error) setMessage(error.message); else await refresh();
  }

  async function generate(rule: RecurringRule, dates: string[]) {
    if (!supabase || !session || !dates.length) return;
    const account = accounts.find((item) => item.is_default) ?? accounts[0];
    if (!account) return;
    setWorking(rule.id); setMessage(null);
    const rows = dates.map((date) => ({
      user_id: session.user.id,
      account_id: account.id,
      transaction_date: date,
      name: rule.name,
      amount: Number(rule.amount),
      direction: Number(rule.amount) >= 0 ? "income" : "expense",
      category_id: rule.category_id,
      subcategory_id: rule.subcategory_id,
      context: rule.context,
      recurring_rule_id: rule.id,
      source: "recurring",
      source_external_id: `${rule.id}:${date}`,
    }));
    const { error } = await supabase.from("transactions").upsert(rows, { onConflict: "user_id,source,source_external_id", ignoreDuplicates: true });
    setWorking(null);
    if (error) setMessage(error.message); else { setMessage(`${dates.length} movimientos recurrentes generados.`); await refresh(); }
  }

  return (
    <div className="page">
      <PageHeader eyebrow="Automatización controlada" title="Movimientos recurrentes" description="Las vigencias futuras crean movimientos nuevos; nunca reescriben el histórico. Se evita duplicar cada regla y mes." />
      <div className="stat-strip" style={{ marginBottom: 18 }}><span>Reglas activas<strong>{recurringRules.filter((item) => item.is_active).length}</strong></span><span>Impacto mensual previsto<strong className={monthlyNet >= 0 ? "positive" : "negative"}>{formatCurrency(monthlyNet)}</strong></span><span>Parking desde agosto<strong>+35,00 €</strong></span></div>
      {message ? <p className="notice">{message}</p> : null}
      <section className="grid two-column">
        {plans.map(({ rule, upcoming, due }) => (
          <article className="card" key={rule.id}>
            <div className="card-header"><div><span className={`badge ${rule.is_active ? "" : "red"}`}>{rule.is_active ? "Activa" : "Pausada"}</span><h2 style={{ marginTop: 10 }}>{rule.name}</h2><p>{rule.frequency === "monthly" ? `Cada mes, día ${rule.day_of_month}` : rule.frequency}</p></div><strong className={`amount ${rule.amount >= 0 ? "positive" : "negative"}`}>{formatCurrency(Number(rule.amount))}</strong></div>
            <div className="card-body">
              <p className="notice success">Vigente desde {formatDate(rule.effective_from)}{rule.effective_until ? ` hasta ${formatDate(rule.effective_until)}` : " sin fecha final"}.</p>
              <div className="result-row"><span>Próximas fechas</span><strong>{upcoming.slice(0, 3).map((date) => formatDate(date)).join(" · ") || "Sin pendientes"}</strong></div>
              <div className="form-actions">
                <button className="button" onClick={() => void toggle(rule)} disabled={working === rule.id}>{rule.is_active ? <Pause size={15} /> : <Play size={15} />}{rule.is_active ? "Pausar" : "Reactivar"}</button>
                <button className="button primary" onClick={() => void generate(rule, due)} disabled={!due.length || working === rule.id}>{working === rule.id ? <LoaderCircle className="spin" size={15} /> : <CalendarCheck size={15} />}Generar vencidos ({due.length})</button>
              </div>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
