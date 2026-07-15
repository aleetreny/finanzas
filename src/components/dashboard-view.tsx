"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowDownRight, ArrowUpRight, CalendarDays, Plus, Scale, Wallet } from "lucide-react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useFinance } from "@/components/finance-provider";
import { MetricCard } from "@/components/metric-card";
import { PageHeader } from "@/components/page-header";
import { formatCurrency, monthKey } from "@/lib/format";

const monthLabel = new Intl.DateTimeFormat("es-ES", {
  month: "short",
  year: "2-digit",
  timeZone: "UTC",
});

export function DashboardView() {
  const { transactions, categories } = useFinance();
  const years = useMemo(
    () => [...new Set(transactions.map((row) => row.transaction_date.slice(0, 4)))].sort().reverse(),
    [transactions],
  );
  const [year, setYear] = useState("all");
  const filtered = useMemo(
    () => transactions.filter((row) => year === "all" || row.transaction_date.startsWith(year)),
    [transactions, year],
  );
  const categoryById = useMemo(
    () => new Map(categories.map((category) => [category.id, category.name])),
    [categories],
  );

  const totals = useMemo(() => filtered.reduce(
    (result, row) => {
      if (row.amount >= 0) result.income += row.amount;
      else result.expenses += Math.abs(row.amount);
      result.net += row.amount;
      return result;
    },
    { income: 0, expenses: 0, net: 0 },
  ), [filtered]);

  const monthly = useMemo(() => {
    const map = new Map<string, { month: string; income: number; expenses: number; net: number }>();
    filtered.forEach((row) => {
      const key = monthKey(row.transaction_date);
      const item = map.get(key) ?? { month: key, income: 0, expenses: 0, net: 0 };
      if (row.amount >= 0) item.income += row.amount;
      else item.expenses += Math.abs(row.amount);
      item.net += row.amount;
      map.set(key, item);
    });
    return [...map.values()].sort((a, b) => a.month.localeCompare(b.month)).map((item) => ({
      ...item,
      label: monthLabel.format(new Date(`${item.month}-01T00:00:00Z`)),
    }));
  }, [filtered]);

  const categorySpend = useMemo(() => {
    const map = new Map<string, number>();
    filtered.filter((row) => row.amount < 0).forEach((row) => {
      const name = categoryById.get(row.category_id ?? "") ?? "Sin categoría";
      map.set(name, (map.get(name) ?? 0) + Math.abs(row.amount));
    });
    return [...map.entries()]
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 7);
  }, [categoryById, filtered]);
  const maxCategory = categorySpend[0]?.amount ?? 1;

  return (
    <div className="page">
      <PageHeader
        eyebrow="Vista general"
        title="Tu dinero, de un vistazo"
        description="Un resumen del flujo de caja real. Los reembolsos se conservan como movimientos independientes."
        action={<Link className="button primary" href="/movimientos/nuevo"><Plus size={17} /><span className="optional">Nuevo movimiento</span></Link>}
      />

      <div className="toolbar">
        <CalendarDays size={16} />
        <select className="select-field" value={year} onChange={(event) => setYear(event.target.value)} aria-label="Filtrar por año">
          <option value="all">Todo el histórico</option>
          {years.map((item) => <option value={item} key={item}>{item}</option>)}
        </select>
        <span className="badge">{filtered.length.toLocaleString("es-ES")} movimientos</span>
      </div>

      <section className="grid metrics-grid">
        <MetricCard label="Saldo neto" value={formatCurrency(totals.net)} note="Ingresos menos gastos" icon={Scale} tone={totals.net >= 0 ? "positive" : "negative"} />
        <MetricCard label="Ingresos" value={formatCurrency(totals.income)} note="Entradas del periodo" icon={ArrowUpRight} tone="positive" />
        <MetricCard label="Gastos" value={formatCurrency(totals.expenses)} note="Salidas en valor absoluto" icon={ArrowDownRight} tone="negative" />
        <MetricCard label="Media mensual" value={formatCurrency(monthly.length ? totals.net / monthly.length : 0)} note={`${monthly.length} meses con actividad`} icon={Wallet} />
      </section>

      <section className="grid content-grid">
        <article className="card">
          <div className="card-header"><div><h2>Evolución mensual</h2><p>Ingresos, gastos y resultado neto</p></div></div>
          {monthly.length ? (
            <div className="chart-wrap">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={monthly} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id="incomeFill" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#2f6256" stopOpacity={0.22}/><stop offset="95%" stopColor="#2f6256" stopOpacity={0}/></linearGradient>
                    <linearGradient id="expenseFill" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#b54b4b" stopOpacity={0.16}/><stop offset="95%" stopColor="#b54b4b" stopOpacity={0}/></linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} stroke="#e9ebe6" />
                  <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: "#7a8580", fontSize: 10 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: "#7a8580", fontSize: 10 }} tickFormatter={(value) => `${Math.round(value / 1000)}k`} width={32} />
                  <Tooltip formatter={(value) => formatCurrency(Number(value))} contentStyle={{ borderRadius: 10, borderColor: "#e2e4de", fontSize: 11 }} />
                  <Area type="monotone" dataKey="income" name="Ingresos" stroke="#2f6256" strokeWidth={2} fill="url(#incomeFill)" />
                  <Area type="monotone" dataKey="expenses" name="Gastos" stroke="#b54b4b" strokeWidth={2} fill="url(#expenseFill)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : <div className="chart-empty">No hay datos para este periodo.</div>}
        </article>

        <article className="card">
          <div className="card-header"><div><h2>Gasto por categoría</h2><p>Las siete categorías principales</p></div></div>
          <div className="category-list">
            {categorySpend.map((item) => (
              <div className="category-row" key={item.name}>
                <strong>{item.name}</strong>
                <div className="progress"><span style={{ width: `${Math.max(3, item.amount / maxCategory * 100)}%` }} /></div>
                <small>{formatCurrency(item.amount)}</small>
              </div>
            ))}
            {!categorySpend.length ? <p className="notice">No hay gastos en el periodo.</p> : null}
          </div>
        </article>
      </section>
    </div>
  );
}
