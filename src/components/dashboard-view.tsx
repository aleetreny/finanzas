"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useFinance } from "@/components/finance-provider";
import { formatCurrency, formatDate } from "@/lib/format";

const MES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const MES_LARGO = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

// Tintas de boli: negro primero; el resto solo para distinguir series.
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

// Generador pseudoaleatorio con semilla: el temblor del trazo es estable entre
// renders (si no, las líneas "bailarían" al pasar el ratón).
function mulberry32(seed: number) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Convierte una polilínea en un trazo tembloroso, como hecho a lápiz.
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

function truncate(text: string, max: number) {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

export function DashboardView() {
  const { transactions, categories, subcategories } = useFinance();

  const categoryName = useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories]);
  const subcategoryName = useMemo(() => new Map(subcategories.map((s) => [s.id, s.name])), [subcategories]);

  // ¿Pantalla estrecha? El gráfico usa una geometría más compacta y legible.
  // Se escucha también `resize` (giro del móvil, emuladores que no disparan
  // el evento `change` del matchMedia…) para no quedarse con un valor viejo.
  const [compact, setCompact] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 720px)");
    const update = () => setCompact(mq.matches);
    update();
    mq.addEventListener("change", update);
    window.addEventListener("resize", update);
    return () => {
      mq.removeEventListener("change", update);
      window.removeEventListener("resize", update);
    };
  }, []);

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

  // gasto[categoría][mes] y gasto[subcategoría][mes]
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

  const bySubMonth = useMemo(() => {
    const map = new Map<string, Map<string, number>>();
    transactions.forEach((t) => {
      if (t.amount >= 0 || !t.subcategory_id) return;
      const key = t.transaction_date.slice(0, 7);
      let inner = map.get(t.subcategory_id);
      if (!inner) { inner = new Map(); map.set(t.subcategory_id, inner); }
      inner.set(key, (inner.get(key) ?? 0) + Math.abs(t.amount));
    });
    return map;
  }, [transactions]);

  const rangeOptions = useMemo(() => {
    const opts: { label: string; value: number | "all" }[] = [];
    [6, 12, 24].forEach((v) => { if (allMonths.length > v) opts.push({ label: String(v), value: v }); });
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
  const [subSelected, setSubSelected] = useState<string[]>([]);
  const [hover, setHover] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const chartRef = useRef<HTMLDivElement | null>(null);

  const visibleMonths = useMemo(
    () => (range === "all" ? allMonths : allMonths.slice(Math.max(0, allMonths.length - range))),
    [allMonths, range],
  );

  function toggle(id: string) {
    setSubSelected([]);
    setHover(null);
    setSelected((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  }
  function toggleSub(id: string) {
    setHover(null);
    setSubSelected((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  }
  function pickRange(v: number | "all") {
    setRange(v);
    setHover(null); // el índice de hover deja de ser válido al cambiar el rango
  }

  // Desglose: con una sola categoría marcada se pueden añadir sus subcategorías
  const drillSubs = useMemo(() => {
    if (selected.length !== 1) return [];
    return subcategories.filter((s) => s.category_id === selected[0] && bySubMonth.has(s.id));
  }, [selected, subcategories, bySubMonth]);

  // Series a dibujar: categorías marcadas + subcategorías desglosadas
  const series = useMemo(() => {
    const cats = selected.map((id, i) => ({
      id,
      name: categoryName.get(id) ?? "—",
      pen: penFor(i),
      points: visibleMonths.map((mk) => byCatMonth.get(id)?.get(mk) ?? 0),
    }));
    const subs = selected.length === 1
      ? subSelected.map((id, i) => ({
          id: `sub-${id}`,
          name: subcategoryName.get(id) ?? "—",
          pen: penFor(selected.length + i),
          points: visibleMonths.map((mk) => bySubMonth.get(id)?.get(mk) ?? 0),
        }))
      : [];
    return [...cats, ...subs];
  }, [selected, subSelected, visibleMonths, byCatMonth, bySubMonth, categoryName, subcategoryName]);

  const yMax = useMemo(() => niceCeil(Math.max(1, ...series.flatMap((s) => s.points))), [series]);

  // Geometría del lienzo (compacta en pantallas estrechas para que se lea)
  const W = compact ? 620 : 1000;
  const H = compact ? 470 : 460;
  const padL = compact ? 66 : 58;
  const padR = compact ? 26 : 112;
  const padT = compact ? 40 : 26;
  const padB = compact ? 52 : 42;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const n = visibleMonths.length;
  const xAt = (i: number) => (n <= 1 ? padL + plotW / 2 : padL + (i / (n - 1)) * plotW);
  const yAt = (v: number) => padT + (1 - v / yMax) * plotH;
  const yTicks = [0, yMax / 2, yMax];
  const monthEvery = compact ? (n > 9 ? 3 : n > 6 ? 2 : 1) : n > 14 ? 2 : 1;
  const hi = hover !== null && hover >= 0 && hover < n ? hover : null;

  // Trazos temblorosos (semilla estable) — recalculados si cambia la geometría
  const roughSeries = useMemo(
    () =>
      series.map((s, si) => {
        const rand = mulberry32(101 + si * 97 + n * 7 + Math.round(yMax));
        const pts = s.points.map((v, i) => [xAt(i), yAt(v)] as [number, number]);
        return { ...s, d: roughPath(pts, rand, compact ? 1.1 : 1.3), pts };
      }),
    // xAt/yAt derivan de n, yMax y compact (geometría); series cubre los datos
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [series, n, yMax, compact],
  );
  const roughAxis = roughPath([[padL, padT], [padL, padT + plotH], [padL + plotW, padT + plotH]], mulberry32(7), 1.1);

  // Etiquetas al final de cada línea (solo escritorio): recortadas y separadas
  const endLabels = useMemo(() => {
    if (compact) return [];
    const labels = roughSeries.map((s) => ({
      id: s.id,
      name: truncate(s.name, 13),
      color: s.pen.color,
      y: Math.max(padT + 10, Math.min(padT + plotH - 4, s.pts[s.pts.length - 1]?.[1] ?? padT)),
    })).sort((a, b) => a.y - b.y);
    for (let i = 1; i < labels.length; i += 1) {
      if (labels[i].y - labels[i - 1].y < 19) labels[i].y = labels[i - 1].y + 19;
    }
    return labels;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roughSeries, compact]);

  function onMove(e: React.PointerEvent<SVGSVGElement>) {
    const svg = svgRef.current;
    if (!svg || n === 0) return;
    const rect = svg.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * W;
    let i = n <= 1 ? 0 : Math.round(((x - padL) / plotW) * (n - 1));
    i = Math.max(0, Math.min(n - 1, i));
    setHover(i);
  }

  // Este mes vs. lo habitual (media de los últimos 6 meses completos)
  const now = new Date();
  const currentKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const budgetAll = useMemo(() => {
    const completeMonths = allMonths.filter((m) => m < currentKey).slice(-6);
    return expenseCategories
      .map((c) => {
        const inner = byCatMonth.get(c.id);
        const nowVal = inner?.get(currentKey) ?? 0;
        const samples = completeMonths.map((m) => inner?.get(m) ?? 0);
        const usual = samples.length ? samples.reduce((a, b) => a + b, 0) / samples.length : 0;
        const pct = usual > 0 ? (nowVal - usual) / usual : null;
        return { id: c.id, name: c.name, now: nowVal, usual, pct };
      })
      .filter((r) => r.now > 0 || r.usual > 0)
      .sort((a, b) => b.now - a.now);
  }, [expenseCategories, byCatMonth, allMonths, currentKey]);
  const budget = budgetAll.slice(0, 10);

  // La misma escala para todas las barras: si Comida es el triple, se ve el triple
  const budgetMax = Math.max(1, ...budget.map((r) => Math.max(r.now, r.usual))) * 1.08;

  // Resumen del mes (sobre TODAS las categorías, no solo las diez dibujadas)
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const monthTotal = budgetAll.reduce((s, r) => s + r.now, 0);
  const usualFullMonth = budgetAll.reduce((s, r) => s + r.usual, 0);
  const usualToDate = usualFullMonth * (now.getDate() / daysInMonth);
  const heroPct = usualToDate > 0 ? (monthTotal - usualToDate) / usualToDate : null;

  function addToChart(id: string) {
    if (!selected.includes(id)) toggle(id);
    chartRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  const lastEntries = useMemo(
    () =>
      [...transactions]
        .sort((a, b) => b.transaction_date.localeCompare(a.transaction_date) || (b.created_at ?? "").localeCompare(a.created_at ?? ""))
        .slice(0, 4),
    [transactions],
  );

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
      </div>

      {/* Lo primero: cuánto llevo este mes */}
      <div className="hero-month">
        <p className="hero-line">
          En {MES_LARGO[now.getMonth()]} llevo <strong>{formatCurrency(monthTotal)}</strong>
        </p>
        {heroPct !== null ? (
          <p className="hero-note">
            lo normal a día {now.getDate()} serían ~{formatCurrency(usualToDate)} →{" "}
            {Math.abs(heroPct) < 0.05
              ? <span>vas como siempre</span>
              : <span className={heroPct > 0 ? "up" : "down"}>{heroPct > 0 ? "+" : ""}{Math.round(heroPct * 100)}% {heroPct > 0 ? "por encima" : "por debajo"}</span>}
          </p>
        ) : null}
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

      {/* Desglose de una categoría en sus subcategorías */}
      {drillSubs.length ? (
        <>
          <p className="evo-ask small">Desglosar {categoryName.get(selected[0])?.toLowerCase()} en…</p>
          <div className="pick-list">
            {drillSubs.map((s) => {
              const idx = subSelected.indexOf(s.id);
              const on = idx >= 0;
              const pen = on ? penFor(selected.length + idx) : null;
              return (
                <button type="button" key={s.id} className={`pick small ${on ? "on" : ""}`} onClick={() => toggleSub(s.id)} aria-pressed={on}>
                  <span className="box" />
                  {on && pen ? <span className="stroke" style={{ borderTopColor: pen.color, borderTopStyle: pen.dashed ? "dashed" : "solid" }} /> : null}
                  {s.name}
                </button>
              );
            })}
          </div>
        </>
      ) : null}

      <div className="range-row">
        <span className="lbl">Meses:</span>
        {rangeOptions.map((o) => (
          <button type="button" key={o.label} className={`range-btn ${range === o.value ? "on" : ""}`} onClick={() => pickRange(o.value)}>{o.label}</button>
        ))}
      </div>

      <div className="chart-card" ref={chartRef}>
        {series.length && n > 0 ? (
          <svg
            ref={svgRef}
            className={`evo-chart ${compact ? "compact" : ""}`}
            viewBox={`0 0 ${W} ${H}`}
            role="img"
            aria-label="Evolución del gasto por categoría"
            onPointerMove={onMove}
            onPointerDown={onMove}
            onPointerLeave={() => setHover(null)}
          >
            <g>
              {yTicks.map((v, ti) => (
                <path key={`g${v}`} d={roughPath([[padL, yAt(v)], [padL + plotW, yAt(v)]], mulberry32(31 + ti * 13), 1)} fill="none" stroke="#cfc7b2" strokeWidth={1.2} strokeDasharray="2 6" />
              ))}
              <path d={roughAxis} fill="none" stroke="#24211a" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
              {roughSeries.map((s) => (
                <path key={s.id} d={s.d} fill="none" stroke={s.pen.color} strokeWidth={compact ? 3.4 : 2.8} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={s.pen.dashed ? "9 6" : undefined} />
              ))}
              {roughSeries.map((s) => s.pts.map(([cx, cy], i) => (
                <circle key={`${s.id}-${i}`} cx={cx} cy={cy} r={compact ? 3.6 : 2.7} fill={s.pen.color} />
              )))}
              {hi !== null ? <line x1={xAt(hi)} y1={padT} x2={xAt(hi)} y2={padT + plotH} stroke="#24211a" strokeWidth={1.4} strokeDasharray="3 4" /> : null}
              {hi !== null ? roughSeries.map((s) => (
                <circle key={`hi-${s.id}`} cx={s.pts[hi][0]} cy={s.pts[hi][1]} r={compact ? 6.5 : 5} fill="none" stroke={s.pen.color} strokeWidth={2} />
              )) : null}
            </g>

            <g>
              {yTicks.map((v) => (
                <text key={`t${v}`} className="axis-num" x={padL - 8} y={yAt(v) + 4} textAnchor="end">{euroShort(v)}</text>
              ))}
              {visibleMonths.map((mk, i) => (
                i % monthEvery === 0 ? (
                  <text key={mk} className="month-lab" x={xAt(i)} y={padT + plotH + (compact ? 30 : 22)} textAnchor="middle">{monthLabel(mk, mk.endsWith("-01") || i === 0)}</text>
                ) : null
              ))}
              {endLabels.map((l) => (
                <text key={`lab${l.id}`} className="series-lab" x={padL + plotW + 9} y={l.y + 4} style={{ fill: l.color }}>{l.name}</text>
              ))}
              {hi !== null ? (
                <>
                  <text x={Math.max(padL + 30, Math.min(padL + plotW - 30, xAt(hi)))} y={padT - 10} textAnchor="middle" className="hover-month">{monthLabel(visibleMonths[hi], true)}</text>
                  {roughSeries.map((s) => (
                    <text key={`hv${s.id}`} x={Math.max(padL + 22, Math.min(padL + plotW - 22, xAt(hi)))} y={s.pts[hi][1] - (compact ? 12 : 9)} textAnchor="middle" className="hover-val" style={{ fill: s.pen.color }}>{euroShort(s.points[hi])}</text>
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

      <p className="section-title">Este mes, por categoría</p>
      <p className="section-sub">Cuánto llevas de cada una comparado con lo que sueles gastar. La rayita es “lo normal”.</p>
      <div className="budget-list">
        {budget.map((r, i) => {
          const nowW = Math.min(100, (r.now / budgetMax) * 100);
          const usualPos = Math.min(100, (r.usual / budgetMax) * 100);
          const over = r.pct !== null && r.pct > 0.05;
          const under = r.pct !== null && r.pct < -0.05;
          return (
            <div className="budget-row" key={r.id}>
              <div className="budget-top">
                <button type="button" className="name" onClick={() => addToChart(r.id)} title="Ver su evolución arriba">{r.name}</button>
                <span className={`note ${over ? "over" : under ? "under" : ""}`}>
                  {r.pct === null ? "primer mes" : Math.abs(r.pct) < 0.05 ? "≈ como siempre" : `${r.pct > 0 ? "+" : ""}${Math.round(r.pct * 100)}% de lo normal`}
                </span>
              </div>
              <div className="budget-track">
                <span className="base" />
                <span className="fill" style={{ width: `${Math.max(1.2, nowW)}%` }} />
                {r.usual > 0 ? <span className={`usual ${i === 0 ? "lbl" : ""}`} style={{ left: `${usualPos}%` }} /> : null}
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

      <div className="hand-rule" />

      <p className="section-title">Últimos apuntes</p>
      <div className="last-list">
        {lastEntries.map((t) => (
          <div className="last-row" key={t.id}>
            <span className="what">{t.name}</span>
            <span className="when">{formatDate(t.transaction_date)}</span>
            <span className={`amount ${t.amount >= 0 ? "positive" : ""}`}>{formatCurrency(t.amount)}</span>
          </div>
        ))}
        <Link className="see-all" href="/movimientos">ver todos los apuntes →</Link>
      </div>
    </div>
  );
}
