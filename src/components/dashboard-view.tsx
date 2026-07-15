"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowDownRight, Layers, Plus, Receipt, Tag, TrendingDown, TrendingUp } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useFinance } from "@/components/finance-provider";
import { PageHeader } from "@/components/page-header";
import { formatCurrency } from "@/lib/format";
import { colorForIndex } from "@/lib/palette";

const MONTHS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
const MONTHS_LONG = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
const OTHERS = "Otros";
const OTHERS_COLOR = "#b3a98f";
const TOP_N = 6;

function pad(month: number) {
  return String(month).padStart(2, "0");
}

export function DashboardView() {
  const { transactions, categories } = useFinance();

  const now = new Date();
  const currentYear = String(now.getFullYear());
  const currentMonth = now.getMonth() + 1;

  const categoryName = useMemo(
    () => new Map(categories.map((item) => [item.id, item.name])),
    [categories],
  );

  const years = useMemo(
    () => [...new Set(transactions.map((row) => row.transaction_date.slice(0, 4)))].sort().reverse(),
    [transactions],
  );

  const lastActiveMonth = useMemo(() => {
    return (target: string) => {
      let last = 0;
      transactions.forEach((row) => {
        if (row.transaction_date.startsWith(target)) {
          const month = Number(row.transaction_date.slice(5, 7));
          if (month > last) last = month;
        }
      });
      return last || currentMonth;
    };
  }, [transactions, currentMonth]);

  const [year, setYear] = useState(() => (years.includes(currentYear) ? currentYear : years[0] ?? currentYear));
  const [month, setMonth] = useState(() => {
    const initialYear = years.includes(currentYear) ? currentYear : years[0] ?? currentYear;
    if (initialYear === currentYear) return currentMonth;
    let last = 0;
    transactions.forEach((row) => {
      if (row.transaction_date.startsWith(initialYear)) {
        const m = Number(row.transaction_date.slice(5, 7));
        if (m > last) last = m;
      }
    });
    return last || 12;
  });

  function changeYear(nextYear: string) {
    setYear(nextYear);
    setMonth(nextYear === currentYear ? currentMonth : lastActiveMonth(nextYear));
  }

  // Gasto de cada mes del año seleccionado (tira de meses + máximo para escalar)
  const expenseByMonth = useMemo(() => {
    const arr = new Array(12).fill(0);
    transactions.forEach((row) => {
      if (row.amount < 0 && row.transaction_date.startsWith(year)) {
        arr[Number(row.transaction_date.slice(5, 7)) - 1] += Math.abs(row.amount);
      }
    });
    return arr as number[];
  }, [transactions, year]);
  const maxMonth = Math.max(1, ...expenseByMonth);

  // Movimientos del mes seleccionado
  const monthPrefix = `${year}-${pad(month)}`;
  const monthTx = useMemo(
    () => transactions.filter((row) => row.transaction_date.startsWith(monthPrefix)),
    [transactions, monthPrefix],
  );
  const monthExpense = monthTx.filter((r) => r.amount < 0).reduce((s, r) => s + Math.abs(r.amount), 0);
  const monthIncome = monthTx.filter((r) => r.amount > 0).reduce((s, r) => s + r.amount, 0);

  // Mes anterior (para el delta)
  const prevMonthExpense = useMemo(() => {
    const prevYear = month === 1 ? Number(year) - 1 : Number(year);
    const prevMonth = month === 1 ? 12 : month - 1;
    const prefix = `${prevYear}-${pad(prevMonth)}`;
    return transactions
      .filter((r) => r.amount < 0 && r.transaction_date.startsWith(prefix))
      .reduce((s, r) => s + Math.abs(r.amount), 0);
  }, [transactions, year, month]);
  const deltaPct = prevMonthExpense > 0 ? (monthExpense - prevMonthExpense) / prevMonthExpense : null;

  // Categoría top y gasto mayor del mes
  const monthByCategory = useMemo(() => {
    const map = new Map<string, number>();
    monthTx.filter((r) => r.amount < 0).forEach((r) => {
      const name = categoryName.get(r.category_id ?? "") ?? "Sin categoría";
      map.set(name, (map.get(name) ?? 0) + Math.abs(r.amount));
    });
    return [...map.entries()].map(([name, amount]) => ({ name, amount })).sort((a, b) => b.amount - a.amount);
  }, [monthTx, categoryName]);
  const topCategory = monthByCategory[0];
  const biggest = monthTx.filter((r) => r.amount < 0).sort((a, b) => a.amount - b.amount)[0];

  const daysInMonth = new Date(Number(year), month, 0).getDate();
  const elapsed = year === currentYear && month === currentMonth ? Math.min(now.getDate(), daysInMonth) : daysInMonth;
  const dailyAvg = elapsed > 0 ? monthExpense / elapsed : 0;

  // Categorías top del año → columnas del gráfico de evolución
  const topCategories = useMemo(() => {
    const map = new Map<string, number>();
    transactions.forEach((row) => {
      if (row.amount < 0 && row.transaction_date.startsWith(year)) {
        const name = categoryName.get(row.category_id ?? "") ?? "Sin categoría";
        map.set(name, (map.get(name) ?? 0) + Math.abs(row.amount));
      }
    });
    return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, TOP_N).map(([name]) => name);
  }, [transactions, year, categoryName]);

  const colorByName = useMemo(() => {
    const map = new Map<string, string>();
    categories.filter((c) => c.is_active).forEach((c, i) => map.set(c.name, colorForIndex(i)));
    return map;
  }, [categories]);

  // Serie mensual apilada por tipo de gasto
  const evolution = useMemo(() => {
    const rows = MONTHS.map((label) => {
      const row: Record<string, number | string> = { label };
      topCategories.forEach((name) => { row[name] = 0; });
      row[OTHERS] = 0;
      return row;
    });
    transactions.forEach((row) => {
      if (row.amount >= 0 || !row.transaction_date.startsWith(year)) return;
      const idx = Number(row.transaction_date.slice(5, 7)) - 1;
      const name = categoryName.get(row.category_id ?? "") ?? "Sin categoría";
      const key = topCategories.includes(name) ? name : OTHERS;
      rows[idx][key] = (rows[idx][key] as number) + Math.abs(row.amount);
    });
    return rows;
  }, [transactions, year, topCategories, categoryName]);
  const stackKeys = [...topCategories, ...(evolution.some((r) => (r[OTHERS] as number) > 0) ? [OTHERS] : [])];
  const hasYearData = expenseByMonth.some((v) => v > 0);

  if (!transactions.length) {
    return (
      <div className="page">
        <PageHeader eyebrow="Resumen" title="Aún no hay nada anotado" description="Empieza registrando tu primer movimiento." action={<Link className="button primary" href="/movimientos/nuevo"><Plus size={16} />Anotar</Link>} />
        <div className="empty-state"><p>Cuando anotes gastos verás aquí su evolución mes a mes.</p></div>
      </div>
    );
  }

  return (
    <div className="page">
      <PageHeader
        eyebrow={`Resumen · ${year}`}
        title="En qué se va el dinero"
        description="El mes en curso, con la evolución de cada tipo de gasto a lo largo del año."
        action={<Link className="button primary" href="/movimientos/nuevo"><Plus size={16} /><span className="optional">Anotar</span></Link>}
      />

      <div className="toolbar">
        <select className="select-field" value={year} onChange={(e) => changeYear(e.target.value)} aria-label="Año">
          {years.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
        <span className="badge">{monthTx.length} mov. en {MONTHS_LONG[month - 1].toLowerCase()}</span>
      </div>

      {/* Tira de meses: el año de un vistazo + selector del mes */}
      <div className="month-strip" role="tablist" aria-label="Meses">
        {MONTHS.map((label, i) => {
          const value = expenseByMonth[i];
          const selected = i + 1 === month;
          return (
            <button
              key={label}
              type="button"
              role="tab"
              aria-selected={selected}
              className={`month-cell ${selected ? "selected" : ""} ${value === 0 ? "empty" : ""}`}
              onClick={() => setMonth(i + 1)}
              title={`${MONTHS_LONG[i]}: ${formatCurrency(value)}`}
            >
              <span className="mbar-track"><span className="mbar" style={{ height: `${Math.max(value > 0 ? 8 : 0, (value / maxMonth) * 100)}%` }} /></span>
              <span className="mlabel">{label}</span>
            </button>
          );
        })}
      </div>

      {/* Cosas del mes */}
      <section className="grid metrics-grid">
        <article className="card metric-card">
          <span className="metric-label"><Receipt size={13} />Gasto de {MONTHS_LONG[month - 1]}</span>
          <strong className="metric-value negative">{formatCurrency(monthExpense)}</strong>
          <small className="metric-note">
            {deltaPct === null ? "Sin mes anterior para comparar" : (
              <span className={`delta ${deltaPct > 0.005 ? "up" : deltaPct < -0.005 ? "down" : "flat"}`}>
                {deltaPct > 0.005 ? <TrendingUp size={12} /> : deltaPct < -0.005 ? <TrendingDown size={12} /> : null}
                {deltaPct > 0 ? "+" : ""}{Math.round(deltaPct * 100)}% vs. mes anterior
              </span>
            )}
          </small>
        </article>
        <article className="card metric-card">
          <span className="metric-label"><Tag size={13} />Categoría top</span>
          <strong className="metric-value">{topCategory ? topCategory.name : "—"}</strong>
          <small className="metric-note">{topCategory ? formatCurrency(topCategory.amount) : "Sin gastos este mes"}</small>
        </article>
        <article className="card metric-card">
          <span className="metric-label"><ArrowDownRight size={13} />Gasto mayor</span>
          <strong className="metric-value" style={{ fontSize: "clamp(15px, 1.8vw, 19px)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{biggest ? biggest.name : "—"}</strong>
          <small className="metric-note">{biggest ? formatCurrency(Math.abs(biggest.amount)) : "Sin gastos este mes"}</small>
        </article>
        <article className="card metric-card">
          <span className="metric-label"><Layers size={13} />Media diaria</span>
          <strong className="metric-value">{formatCurrency(dailyAvg)}</strong>
          <small className="metric-note">{monthTx.filter((r) => r.amount < 0).length} gastos · {elapsed} días</small>
        </article>
      </section>

      <div className="stat-strip" style={{ marginBottom: 20 }}>
        <span>Ingresos del mes <strong className="positive">{formatCurrency(monthIncome)}</strong></span>
        <span>Neto <strong className={monthIncome - monthExpense >= 0 ? "positive" : "negative"}>{formatCurrency(monthIncome - monthExpense)}</strong></span>
        <span>Gasto acumulado {year} <strong>{formatCurrency(expenseByMonth.reduce((s, v) => s + v, 0))}</strong></span>
      </div>

      <section className="grid content-grid">
        <article className="card">
          <div className="card-header"><div><h2>Evolución del gasto por tipo</h2><p>Cada color es una categoría, mes a mes en {year}</p></div></div>
          {hasYearData ? (
            <>
              <div className="chart-wrap">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={evolution} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barCategoryGap="22%">
                    <CartesianGrid vertical={false} stroke="var(--rule-2)" />
                    <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 10 }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10 }} width={34} tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : `${v}`)} />
                    <Tooltip formatter={(value) => formatCurrency(Number(value))} cursor={{ fill: "rgba(33,29,22,.05)" }} />
                    {stackKeys.map((key) => (
                      <Bar key={key} dataKey={key} stackId="gasto" fill={key === OTHERS ? OTHERS_COLOR : colorByName.get(key) ?? OTHERS_COLOR} radius={key === stackKeys[stackKeys.length - 1] ? [3, 3, 0, 0] : undefined} maxBarSize={46} isAnimationActive={false} />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="legend">
                {stackKeys.map((key) => (
                  <span className="legend-item" key={key}>
                    <span className="swatch" style={{ background: key === OTHERS ? OTHERS_COLOR : colorByName.get(key) ?? OTHERS_COLOR }} />
                    {key}
                  </span>
                ))}
              </div>
            </>
          ) : <div className="chart-empty">No hay gastos registrados en {year}.</div>}
        </article>

        <article className="card">
          <div className="card-header"><div><h2>{MONTHS_LONG[month - 1]} por categoría</h2><p>Reparto del gasto del mes</p></div></div>
          <div className="rank-list">
            {monthByCategory.slice(0, 8).map((item) => (
              <div className="rank-row" key={item.name}>
                <span className="dot" style={{ background: colorByName.get(item.name) ?? OTHERS_COLOR }} />
                <strong>{item.name}</strong>
                <div className="progress"><span style={{ width: `${monthExpense ? Math.max(3, (item.amount / monthExpense) * 100) : 0}%`, background: colorByName.get(item.name) ?? OTHERS_COLOR }} /></div>
                <small>{formatCurrency(item.amount)}</small>
              </div>
            ))}
            {!monthByCategory.length ? <p className="notice">No hay gastos en {MONTHS_LONG[month - 1].toLowerCase()}.</p> : null}
          </div>
        </article>
      </section>
    </div>
  );
}
