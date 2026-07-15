"use client";

import { useMemo, useState } from "react";
import { ArrowDownRight, ArrowUpRight, CircleAlert, Scale } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useFinance } from "@/components/finance-provider";
import { MetricCard } from "@/components/metric-card";
import { PageHeader } from "@/components/page-header";
import { TransactionList } from "@/components/transaction-list";
import { formatCurrency, monthKey } from "@/lib/format";

export function MalagaView() {
  const { transactions, categories } = useFinance();
  const malagaCategory = categories.find((item) => item.name === "Piso Málaga");
  const allMalaga = useMemo(() => transactions.filter((row) =>
    row.category_id === malagaCategory?.id || row.context === "Piso Málaga",
  ), [malagaCategory?.id, transactions]);
  const years = useMemo(() => [...new Set(allMalaga.map((row) => row.transaction_date.slice(0, 4)))].sort().reverse(), [allMalaga]);
  const platforms = useMemo(() => [...new Set(allMalaga.map((row) => row.platform).filter(Boolean) as string[])].sort(), [allMalaga]);
  const [year, setYear] = useState("all");
  const [platform, setPlatform] = useState("all");
  const filtered = useMemo(() => allMalaga.filter((row) =>
    (year === "all" || row.transaction_date.startsWith(year)) &&
    (platform === "all" || row.platform === platform),
  ), [allMalaga, platform, year]);
  const income = filtered.filter((row) => row.amount > 0).reduce((sum, row) => sum + row.amount, 0);
  const expenses = filtered.filter((row) => row.amount < 0).reduce((sum, row) => sum + Math.abs(row.amount), 0);
  const candidates = filtered.filter((row) =>
    /aire acondicionado|cerradura/i.test(row.name) || /inmovilizado|mejora/i.test(row.fiscal_property_status ?? ""),
  );
  const monthly = useMemo(() => {
    const map = new Map<string, { month: string; income: number; expenses: number }>();
    filtered.forEach((row) => {
      const key = monthKey(row.transaction_date);
      const item = map.get(key) ?? { month: key, income: 0, expenses: 0 };
      if (row.amount >= 0) item.income += row.amount;
      else item.expenses += Math.abs(row.amount);
      map.set(key, item);
    });
    return [...map.values()].sort((a, b) => a.month.localeCompare(b.month));
  }, [filtered]);

  return (
    <div className="page">
      <PageHeader eyebrow="Inmueble" title="Piso Málaga" description="Ingresos bancarios reales, gastos del inmueble y partidas pendientes de revisión. Las etiquetas fiscales son orientativas." />
      <div className="toolbar">
        <select className="select-field" value={year} onChange={(event) => setYear(event.target.value)}><option value="all">Todos los ejercicios</option>{years.map((item) => <option key={item}>{item}</option>)}</select>
        <select className="select-field" value={platform} onChange={(event) => setPlatform(event.target.value)}><option value="all">Todas las plataformas</option>{platforms.map((item) => <option key={item}>{item}</option>)}</select>
        <span className="badge gold">{filtered.length} movimientos</span>
      </div>
      <section className="grid metrics-grid">
        <MetricCard label="Resultado neto" value={formatCurrency(income - expenses)} note="Sin conclusiones fiscales automáticas" icon={Scale} tone={income - expenses >= 0 ? "positive" : "negative"} />
        <MetricCard label="Ingresos" value={formatCurrency(income)} note="Residencial y turístico" icon={ArrowUpRight} tone="positive" />
        <MetricCard label="Gastos" value={formatCurrency(expenses)} note="Salidas vinculadas al inmueble" icon={ArrowDownRight} tone="negative" />
        <MetricCard label="Por revisar" value={String(candidates.length)} note="Candidatos a mejora o inmovilizado" icon={CircleAlert} />
      </section>
      <section className="grid content-grid">
        <article className="card">
          <div className="card-header"><div><h2>Resultado por mes</h2><p>Ingresos y gastos del inmueble</p></div></div>
          <div className="chart-wrap">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthly}><CartesianGrid vertical={false} stroke="var(--rule-2)" /><XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 10 }} /><YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10 }} width={38} /><Tooltip formatter={(value) => formatCurrency(Number(value))} cursor={{ fill: "rgba(33,29,22,.05)" }} /><Bar dataKey="income" name="Ingresos" fill="#3a5a49" radius={[3,3,0,0]} maxBarSize={30} /><Bar dataKey="expenses" name="Gastos" fill="#a54322" radius={[3,3,0,0]} maxBarSize={30} /></BarChart>
            </ResponsiveContainer>
          </div>
        </article>
        <article className="card">
          <div className="card-header"><div><h2>Candidatos a revisión</h2><p>No se amortizan sin confirmación</p></div></div>
          <div className="category-list">
            {candidates.map((row) => <div className="result-row" key={row.id}><span>{row.name}<small style={{ display: "block" }}>{row.transaction_date}</small></span><strong>{formatCurrency(row.amount)}</strong></div>)}
            {!candidates.length ? <p className="notice success">No hay candidatos en este filtro.</p> : null}
          </div>
        </article>
      </section>
      <div style={{ height: 18 }} />
      <TransactionList transactions={filtered} />
    </div>
  );
}
