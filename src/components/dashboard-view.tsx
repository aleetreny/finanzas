"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { useFinance } from "@/components/finance-provider";
import { formatCurrency } from "@/lib/format";

const MES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const MES_LARGO = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

// Tintas de boli: negro por defecto; el resto para distinguir varias series.
const PENS = ["#24211a", "#33518c", "#b23a2b", "#4c6b39", "#9a6d1f"];
function penFor(order: number) {
  return { color: PENS[order % PENS.length], dashed: order >= PENS.length };
}

function addMonths(key: string, delta: number) {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}
function monthLabel(key: string, withYear: boolean) {
  const [y, m] = key.split("-").map(Number);
  return withYear ? `${MES[m - 1]} '${String(y).slice(2)}` : MES[m - 1];
}
function niceCeil(v: number) {
  if (v <= 0) return 10;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const f = v / p;
  const nf = f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10;
  return nf * p;
}
function euroShort(v: number) {
  if (v >= 1000) return `${(v / 1000).toLocaleString("es-ES", { maximumFractionDigits: 1 })}k€`;
  return `${Math.round(v)}€`;
}

// Generador pseudoaleatorio con semilla, para que el temblor sea estable entre
// renders (si no, las líneas "bailarían" al pasar el ratón).
function mulberry32(seed: number) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Convierte una polilínea recta en un trazo tembloroso, como hecho a lápiz.
// Los extremos de cada segmento quedan exactos para que las líneas conecten.
function roughPath(pts: [number, number][], rand: () => number, jitter = 1.4): string {
  let d = "";
  for (let s = 0; s < pts.length - 1; s += 1) {
    const [x1, y1] = pts[s];
    const [x2, y2] = pts[s + 1];
    const dx = x2 - x1, dy = y2 - y1;
    const len = Math.hypot(dx, dy) || 1;
    const steps = Math.max(2, Math.round(len / 15));
    const nx = -dy / len, ny = dx / len;
    for (let k = s === 0 ? 0 : 1; k <= steps; k += 1) {
      const t = k / steps;
      const off = k === 0 || k === steps ? 0 : (rand() * 2 - 1) * jitter;
      const x = x1 + dx * t + nx * off;
      const y = y1 + dy * t + ny * off;
      d += `${d === "" ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
    }
  }
  return d;
}

export function DashboardView() {
  const { transactions, categories } = useFinance();

  const categoryName = useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories]);

  // Total de gasto por categoría (para ordenar y elegir por defecto)
  const catTotals = useMemo(() => {
    const map = new Map<string, number>();
    transactions.forEach((t) => {
      if (t.amount < 0 && t.category_id) map.set(t.category_id, (map.get(t.category_id) ?? 0) + Math.abs(t.amount));
    });
    return map;
  }, [transactions]);

  const expenseCategories = useMemo(
    () =>
      categories
        .filter((c) => c.is_active && (catTotals.get(c.id) ?? 0) > 0)
        .sort((a, b) => (catTotals.get(b.id) ?? 0) - (catTotals.get(a.id) ?? 0)),
    [categories, catTotals],
  );

  // Línea temporal continua desde el primer gasto hasta el mes actual
  const allMonths = useMemo(() => {
    const withData = transactions.filter((t) => t.amount < 0).map((t) => t.transaction_date.slice(0, 7));
    if (!withData.length) return [] as string[];
    const first = withData.reduce((a, b) => (a < b ? a : b));
    const now = new Date();
    const last = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const start = first < last ? first : last;
    const months: string[] = [];
    let cur = start;
    for (let i = 0; i < 240 && cur <= last; i += 1) {
      months.push(cur);
      cur = addMonths(cur, 1);
    }
    return months;
  }, [transactions]);

  // gasto[categoria][mes]
  const byCatMonth = useMemo(() => {
    const map = new Map<string, Map<string, number>>();
    transactions.forEach((t) => {
      if (t.amount >= 0 || !t.category_id) return;
      const key = t.transaction_date.slice(0, 7);
      let inner = map.get(t.category_id);
      if (!inner) { inner = new Map(); map.set(t.category_id, inner); }
      inner.set(key, (inner.get(key) ?? 0) + Math.abs(t.amount));
    });
    return map;
  }, [transactions]);

  const rangeOptions = useMemo(() => {
    const opts: { label: string; value: number | "all" }[] = [];
    [6, 12, 24].forEach((n) => { if (allMonths.length > n) opts.push({ label: String(n), value: n }); });
    opts.push({ label: "Todo", value: "all" });
    return opts;
  }, [allMonths.length]);

  const [range, setRange] = useState<number | "all">(() => (allMonths.length > 12 ? 12 : "all"));
  const [selected, setSelected] = useState<string[]>(() => {
    const comida = categories.find((c) => c.name === "Comida" && (catTotals.get(c.id) ?? 0) > 0);
    if (comida) return [comida.id];
    const top = [...catTotals.entries()].sort((a, b) => b[1] - a[1])[0];
    return top ? [top[0]] : [];
  });
  const [hover, setHover] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  const visibleMonths = useMemo(
    () => (range === "all" ? allMonths : allMonths.slice(Math.max(0, allMonths.length - range))),
    [allMonths, range],
  );

  function toggle(id: string) {
    setSelected((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  }

  // Series a dibujar
  const series = useMemo(
    () =>
      selected.map((id, i) => ({
        id,
        name: categoryName.get(id) ?? "—",
        pen: penFor(i),
        points: visibleMonths.map((mk) => byCatMonth.get(id)?.get(mk) ?? 0),
      })),
    [selected, visibleMonths, byCatMonth, categoryName],
  );

  const yMax = useMemo(() => niceCeil(Math.max(1, ...series.flatMap((s) => s.points))), [series]);

  // Geometría del lienzo
  const W = 1000, H = 460, padL = 58, padR = 96, padT = 22, padB = 42;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const n = visibleMonths.length;
  const xAt = (i: number) => (n <= 1 ? padL + plotW / 2 : padL + (i / (n - 1)) * plotW);
  const yAt = (v: number) => padT + (1 - v / yMax) * plotH;
  const yTicks = [0, yMax / 2, yMax];
  const monthEvery = n > 14 ? 2 : 1;

  // Trazos a lápiz (temblor determinista por semilla → estable entre renders)
  const roughSeries = useMemo(
    () =>
      series.map((s, si) => {
        const rand = mulberry32(101 + si * 97 + n * 7 + Math.round(yMax));
        const pts = s.points.map((v, i) => [xAt(i), yAt(v)] as [number, number]);
        return { id: s.id, pen: s.pen, d: roughPath(pts, rand, 1.3), pts };
      }),
    // xAt/yAt dependen de n y yMax; incluir series cubre los cambios de datos
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [series, n, yMax],
  );
  const roughAxis = roughPath([[padL, padT], [padL, padT + plotH], [padL + plotW, padT + plotH]], mulberry32(7), 1.1);

  function onMove(e: React.PointerEvent<SVGSVGElement>) {
    const svg = svgRef.current;
    if (!svg || n === 0) return;
    const rect = svg.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * W;
    let i = n <= 1 ? 0 : Math.round(((x - padL) / plotW) * (n - 1));
    i = Math.max(0, Math.min(n - 1, i));
    setHover(i);
  }

  // Este mes vs. lo habitual (media de los últimos meses completos)
  const now = new Date();
  const currentKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const budget = useMemo(() => {
    const completeMonths = allMonths.filter((m) => m < currentKey).slice(-6);
    return expenseCategories
      .map((c) => {
        const inner = byCatMonth.get(c.id);
        const nowVal = inner?.get(currentKey) ?? 0;
        const usualSamples = completeMonths.map((m) => inner?.get(m) ?? 0);
        const usual = usualSamples.length ? usualSamples.reduce((a, b) => a + b, 0) / usualSamples.length : 0;
        const pct = usual > 0 ? (nowVal - usual) / usual : null;
        return { id: c.id, name: c.name, now: nowVal, usual, pct };
      })
      .filter((r) => r.now > 0 || r.usual > 0)
      .sort((a, b) => b.now - a.now);
  }, [expenseCategories, byCatMonth, allMonths, currentKey]);

  if (!transactions.length) {
    return (
      <div className="evo">
        <div className="evo-head"><h1>Mis gastos</h1><p>Aún no hay nada anotado.</p></div>
        <div className="empty-state"><p>Anota tu primer gasto y aquí verás cómo evoluciona mes a mes.</p><Link className="button primary" href="/movimientos/nuevo">Anotar un gasto</Link></div>
      </div>
    );
  }

  return (
    <div className="evo">
      <div className="evo-head">
        <h1>Mis gastos, mes a mes</h1>
        <p>Marca lo que quieras mirar y observa cómo cambia. Hoy es {now.getDate()} de {MES_LARGO[now.getMonth()]} de {now.getFullYear()}.</p>
      </div>

      <p className="evo-ask">¿Qué quiero mirar?</p>
      <div className="pick-list">
        {expenseCategories.map((c) => {
          const idx = selected.indexOf(c.id);
          const on = idx >= 0;
          const pen = on ? penFor(idx) : null;
          return (
            <button type="button" key={c.id} className={`pick ${on ? "on" : ""}`} onClick={() => toggle(c.id)} aria-pressed={on}>
              <span className="box" />
              {on && pen ? <span className="stroke" style={{ borderTopColor: pen.color, borderTopStyle: pen.dashed ? "dashed" : "solid" }} /> : null}
              {c.name}
            </button>
          );
        })}
      </div>

      <div className="range-row">
        <span className="lbl">Meses:</span>
        {rangeOptions.map((o) => (
          <button type="button" key={o.label} className={`range-btn ${range === o.value ? "on" : ""}`} onClick={() => setRange(o.value)}>{o.label}</button>
        ))}
      </div>

      <div className="chart-card">
        {series.length && n > 0 ? (
          <svg
            ref={svgRef}
            className="evo-chart"
            viewBox={`0 0 ${W} ${H}`}
            role="img"
            aria-label="Evolución del gasto por categoría"
            onPointerMove={onMove}
            onPointerLeave={() => setHover(null)}
          >
            {/* Trazos a lápiz (temblor generado por JS, sin filtros caros) */}
            <g>
              {/* rejilla horizontal tenue */}
              {yTicks.map((v, ti) => (
                <path key={`g${v}`} d={roughPath([[padL, yAt(v)], [padL + plotW, yAt(v)]], mulberry32(31 + ti * 13), 1)} fill="none" stroke="#cfc7b2" strokeWidth={1.2} strokeDasharray="2 6" />
              ))}
              {/* ejes */}
              <path d={roughAxis} fill="none" stroke="#24211a" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
              {/* líneas de cada serie */}
              {roughSeries.map((s) => (
                <path key={s.id} d={s.d} fill="none" stroke={s.pen.color} strokeWidth={2.8} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={s.pen.dashed ? "9 6" : undefined} />
              ))}
              {/* puntos */}
              {roughSeries.map((s) => s.pts.map(([cx, cy], i) => (
                <circle key={`${s.id}-${i}`} cx={cx} cy={cy} r={2.7} fill={s.pen.color} />
              )))}
              {/* guía vertical al pasar el ratón */}
              {hover !== null ? <line x1={xAt(hover)} y1={padT} x2={xAt(hover)} y2={padT + plotH} stroke="#24211a" strokeWidth={1.4} strokeDasharray="3 4" /> : null}
            </g>

            {/* Texto (sin temblor, para que se lea) */}
            <g>
              {yTicks.map((v) => (
                <text key={`t${v}`} className="axis-num" x={padL - 8} y={yAt(v) + 4} textAnchor="end">{euroShort(v)}</text>
              ))}
              {visibleMonths.map((mk, i) => (
                i % monthEvery === 0 ? (
                  <text key={mk} className="month-lab" x={xAt(i)} y={padT + plotH + 22} textAnchor="middle">{monthLabel(mk, mk.endsWith("-01") || i === 0)}</text>
                ) : null
              ))}
              {/* etiqueta de cada serie al final de su línea */}
              {series.map((s) => {
                const li = s.points.length - 1;
                return (
                  <text key={`lab${s.id}`} className="series-lab" x={xAt(li) + 8} y={yAt(s.points[li]) + 4} fill={s.pen.color}>{s.name}</text>
                );
              })}
              {/* valores al pasar el ratón */}
              {hover !== null ? (
                <>
                  <text x={xAt(hover)} y={padT - 6} textAnchor="middle" className="month-lab" fill="#24211a">{monthLabel(visibleMonths[hover], true)}</text>
                  {series.map((s) => (
                    <text key={`hv${s.id}`} x={xAt(hover)} y={yAt(s.points[hover]) - 8} textAnchor="middle" className="axis-num" fill={s.pen.color}>{euroShort(s.points[hover])}</text>
                  ))}
                </>
              ) : null}
            </g>
          </svg>
        ) : (
          <div className="chart-empty">Marca al menos una categoría arriba para dibujar su evolución.</div>
        )}
      </div>

      <div className="hand-rule" />

      <p className="section-title">Este mes ({MES_LARGO[now.getMonth()]})</p>
      <p className="section-sub">Cuánto llevas de cada categoría comparado con lo que sueles gastar.</p>
      <div className="budget-list">
        {budget.map((r) => {
          const scaleMax = Math.max(r.now, r.usual) * 1.35 || 1;
          const usualPos = (r.usual / scaleMax) * 100;
          const nowW = Math.min(100, (r.now / scaleMax) * 100);
          const over = r.pct !== null && r.pct > 0.05;
          const under = r.pct !== null && r.pct < -0.05;
          return (
            <div className="budget-row" key={r.id}>
              <div className="budget-top">
                <button type="button" className="name" style={{ border: 0, background: "transparent", cursor: "pointer" }} onClick={() => toggle(r.id)} title="Ver su evolución">{r.name}</button>
                <span className={`note ${over ? "over" : under ? "under" : ""}`}>
                  {r.pct === null ? "primer mes" : Math.abs(r.pct) < 0.05 ? "≈ como siempre" : `${r.pct > 0 ? "+" : ""}${Math.round(r.pct * 100)}% de lo normal`}
                </span>
              </div>
              <div className="budget-track">
                <span className="base" />
                <span className={`fill ${over ? "over" : ""}`} style={{ width: `${Math.max(1.5, nowW)}%` }} />
                {r.usual > 0 ? <span className="usual" style={{ left: `${usualPos}%` }} /> : null}
              </div>
              <div className="budget-amt">
                <span className="now">{formatCurrency(r.now)}</span>
                {r.usual > 0 ? <span className="of">de ~{formatCurrency(r.usual)} habituales</span> : null}
              </div>
            </div>
          );
        })}
        {!budget.length ? <p className="chart-empty">Sin gastos este mes todavía.</p> : null}
      </div>
    </div>
  );
}
