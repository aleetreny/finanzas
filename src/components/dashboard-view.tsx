"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { AppLink } from "@/components/app-link";
import { useFinance } from "@/components/finance-provider";
import { categoryById, isMalagaTransaction } from "@/lib/finance-scope";
import { formatCurrency, formatDate } from "@/lib/format";

const MES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const MES_LARGO = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

// Tintas para gastos. Paleta ampliada de 16 colores únicos para que nunca se repitan.
const PENS = [
  "#24211a", // Tinta Negra Carbón
  "#33518c", // Azul Marino Bolígrafo
  "#b23a2b", // Rojo Coral
  "#9a6d1f", // Ocre Miel
  "#6f4d82", // Púrpura Pluma
  "#008080", // Turquesa Teal
  "#d96b27", // Naranja Terracota
  "#2e7d32", // Verde Bosque
  "#c2185b", // Rosa Carmín
  "#455a64", // Gris Pizarra
  "#8d6e63", // Marrón Caoba
  "#0097a7", // Cian Océano
  "#7b1fa2", // Morado Intenso
  "#afb42b", // Verde Oliva
  "#e64a19", // Naranja Bermellón
  "#1976d2", // Azul Cobalto
];
const INCOME_PEN = { color: "#2f7a4b", dashed: true };
const INCOME_SERIES_ID = "income-total";
function penFor(order: number) {
  if (order < PENS.length) {
    return { color: PENS[order], dashed: false };
  }
  const hue = (order * 137.5) % 360;
  return { color: `hsl(${Math.round(hue)}, 65%, 40%)`, dashed: false };
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
  const categoriesById = useMemo(() => categoryById(categories), [categories]);
  const personalTransactions = useMemo(
    () => transactions.filter((transaction) => !isMalagaTransaction(transaction, categoriesById)),
    [categoriesById, transactions],
  );

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
    personalTransactions.forEach((t) => {
      if (t.amount < 0 && t.category_id) map.set(t.category_id, (map.get(t.category_id) ?? 0) + Math.abs(t.amount));
    });
    return map;
  }, [personalTransactions]);

  const expenseCategories = useMemo(
    () =>
      categories
        .filter((c) => c.is_active && c.category_scope === "expense" && (catTotals.get(c.id) ?? 0) > 0)
        .sort((a, b) => (catTotals.get(b.id) ?? 0) - (catTotals.get(a.id) ?? 0)),
    [categories, catTotals],
  );

  // Línea temporal continua desde el primer movimiento hasta el mes actual
  const allMonths = useMemo(() => {
    const withData = personalTransactions.filter((t) => t.amount !== 0).map((t) => t.transaction_date.slice(0, 7));
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
  }, [personalTransactions]);

  // gasto[categoría][mes] y gasto[subcategoría][mes]
  const byCatMonth = useMemo(() => {
    const map = new Map<string, Map<string, number>>();
    personalTransactions.forEach((t) => {
      if (t.amount >= 0 || !t.category_id) return;
      const key = t.transaction_date.slice(0, 7);
      let inner = map.get(t.category_id);
      if (!inner) { inner = new Map(); map.set(t.category_id, inner); }
      inner.set(key, (inner.get(key) ?? 0) + Math.abs(t.amount));
    });
    return map;
  }, [personalTransactions]);

  const bySubMonth = useMemo(() => {
    const map = new Map<string, Map<string, number>>();
    personalTransactions.forEach((t) => {
      if (t.amount >= 0 || !t.subcategory_id) return;
      const key = t.transaction_date.slice(0, 7);
      let inner = map.get(t.subcategory_id);
      if (!inner) { inner = new Map(); map.set(t.subcategory_id, inner); }
      inner.set(key, (inner.get(key) ?? 0) + Math.abs(t.amount));
    });
    return map;
  }, [personalTransactions]);

  const byIncomeMonth = useMemo(() => {
    const map = new Map<string, number>();
    personalTransactions.forEach((transaction) => {
      if (transaction.amount <= 0) return;
      const key = transaction.transaction_date.slice(0, 7);
      map.set(key, (map.get(key) ?? 0) + transaction.amount);
    });
    return map;
  }, [personalTransactions]);

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
  const [incomeSelected, setIncomeSelected] = useState(false);
  const [subSelected, setSubSelected] = useState<string[]>([]);
  const [hover, setHover] = useState<number | null>(null);
  const [activeSeriesId, setActiveSeriesId] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

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
  function toggleIncome() {
    setHover(null);
    setIncomeSelected((current) => !current);
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

  // Series a dibujar: gastos marcados, sus desgloses y los ingresos por separado.
  const series = useMemo(() => {
    const cats = selected.map((id, i) => ({
      id,
      name: categoryName.get(id) ?? "—",
      kind: "expense" as const,
      pen: penFor(i),
      points: visibleMonths.map((mk) => byCatMonth.get(id)?.get(mk) ?? 0),
    }));
    const subs = selected.length === 1
      ? subSelected.map((id, i) => ({
          id: `sub-${id}`,
          name: subcategoryName.get(id) ?? "—",
          kind: "expense" as const,
          pen: penFor(selected.length + i),
          points: visibleMonths.map((mk) => bySubMonth.get(id)?.get(mk) ?? 0),
        }))
      : [];
    const incomes = incomeSelected
      ? [{
          id: INCOME_SERIES_ID,
          name: "Ingresos",
          kind: "income" as const,
          pen: INCOME_PEN,
          points: visibleMonths.map((month) => byIncomeMonth.get(month) ?? 0),
        }]
      : [];
    return [...cats, ...subs, ...incomes];
  }, [selected, subSelected, incomeSelected, visibleMonths, byCatMonth, bySubMonth, byIncomeMonth, categoryName, subcategoryName]);

  const yMax = useMemo(() => niceCeil(Math.max(1, ...series.flatMap((s) => s.points))), [series]);

  // Geometría del lienzo
  const W = compact ? 620 : 1000;
  const H = compact ? 470 : 460;
  const padL = compact ? 66 : 58;
  const padR = compact ? 105 : 135;
  const padT = compact ? 40 : 26;
  const padB = compact ? 54 : 44;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const n = visibleMonths.length;
  const xAt = (i: number) => (n <= 1 ? padL + plotW / 2 : padL + (i / (n - 1)) * plotW);
  const yAt = (v: number) => padT + (1 - v / yMax) * plotH;
  const yTicks = [0, yMax / 2, yMax];
  const monthEvery = compact ? (n > 9 ? 3 : n > 6 ? 2 : 1) : n > 14 ? 2 : 1;
  const hi = hover !== null && hover >= 0 && hover < n ? hover : (n > 0 ? n - 1 : null);

  // Trazos temblorosos (semilla estable)
  const roughSeries = useMemo(
    () =>
      series.map((s, si) => {
        const rand = mulberry32(101 + si * 97 + n * 7 + Math.round(yMax));
        const pts = s.points.map((v, i) => [
          n <= 1 ? padL + plotW / 2 : padL + (i / (n - 1)) * plotW,
          padT + (1 - v / yMax) * plotH,
        ] as [number, number]);
        return { ...s, d: roughPath(pts, rand, compact ? 1.1 : 1.3), pts };
      }),
    [series, n, yMax, compact, padL, plotW, padT, plotH],
  );
  const roughAxis = roughPath([[padL, padT], [padL, padT + plotH], [padL + plotW, padT + plotH]], mulberry32(7), 1.1);

  // Etiquetas al final de cada línea: apiladas de forma inteligente sin salirse NUNCA del lienzo
  const endLabels = useMemo(() => {
    if (roughSeries.length === 0) return [];

    const totalLabels = roughSeries.length;
    const minStep = compact
      ? (totalLabels > 5 ? 16 : 19)
      : (totalLabels > 5 ? 18 : 22);

    const minY = padT + 8;
    const maxY = padT + plotH - (compact ? 12 : 14);

    const labels = roughSeries.map((s) => {
      const origY = s.pts[s.pts.length - 1]?.[1] ?? padT;
      return {
        id: s.id,
        name: truncate(s.name, compact ? 10 : 13),
        color: s.pen.color,
        origY,
        y: Math.max(minY, Math.min(maxY, origY)),
      };
    }).sort((a, b) => a.y - b.y);

    // 1. Pasada hacia abajo imponiendo minStep
    for (let i = 1; i < labels.length; i += 1) {
      if (labels[i].y - labels[i - 1].y < minStep) {
        labels[i].y = labels[i - 1].y + minStep;
      }
    }

    // 2. Pasada de corrección hacia arriba si la última chapa sobrepasa el límite inferior (maxY)
    if (labels.length > 0 && labels[labels.length - 1].y > maxY) {
      labels[labels.length - 1].y = maxY;
      for (let i = labels.length - 2; i >= 0; i -= 1) {
        if (labels[i + 1].y - labels[i].y < minStep) {
          labels[i].y = labels[i + 1].y - minStep;
        }
      }
      // Distribución equitativa si el espacio es muy ajustado
      if (labels[0].y < minY) {
        const availableSpace = maxY - minY;
        const step = availableSpace / Math.max(1, labels.length - 1);
        for (let i = 0; i < labels.length; i += 1) {
          labels[i].y = minY + i * step;
        }
      }
    }

    return labels;
  }, [roughSeries, compact, padT, plotH]);

  function onMove(e: React.PointerEvent<SVGSVGElement>) {
    const svg = svgRef.current;
    if (!svg || n === 0) return;
    const rect = svg.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * W;
    let i = n <= 1 ? 0 : Math.round(((x - padL) / plotW) * (n - 1));
    i = Math.max(0, Math.min(n - 1, i));
    setHover(i);
  }

  function onTouch(e: React.TouchEvent<SVGSVGElement>) {
    const svg = svgRef.current;
    if (!svg || n === 0 || !e.touches || e.touches.length === 0) return;
    const rect = svg.getBoundingClientRect();
    const clientX = e.touches[0].clientX;
    const x = ((clientX - rect.left) / rect.width) * W;
    let i = n <= 1 ? 0 : Math.round(((x - padL) / plotW) * (n - 1));
    i = Math.max(0, Math.min(n - 1, i));
    setHover(i);
  }

  const [expandedCats, setExpandedCats] = useState<Record<string, boolean>>({});

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

  // Desglose de subcategorías para cada categoría principal
  const categorySubcategories = useMemo(() => {
    const map = new Map<string, Array<{ id: string; name: string; now: number; usual: number; pct: number | null }>>();
    const completeMonths = allMonths.filter((m) => m < currentKey).slice(-6);

    expenseCategories.forEach((cat) => {
      const subs = subcategories.filter((s) => s.category_id === cat.id);
      const subList = subs
        .map((s) => {
          const inner = bySubMonth.get(s.id);
          const nowVal = inner?.get(currentKey) ?? 0;
          const samples = completeMonths.map((m) => inner?.get(m) ?? 0);
          const usual = samples.length ? samples.reduce((a, b) => a + b, 0) / samples.length : 0;
          const pct = usual > 0 ? (nowVal - usual) / usual : null;
          return { id: s.id, name: s.name, now: nowVal, usual, pct };
        })
        .filter((sub) => sub.now > 0 || sub.usual > 0)
        .sort((a, b) => b.now - a.now);

      const catNow = byCatMonth.get(cat.id)?.get(currentKey) ?? 0;
      const subNowSum = subList.reduce((acc, sub) => acc + sub.now, 0);
      const diffNow = catNow - subNowSum;

      if (diffNow > 0.5) {
        const catSamples = completeMonths.map((m) => byCatMonth.get(cat.id)?.get(m) ?? 0);
        const catUsual = catSamples.length ? catSamples.reduce((a, b) => a + b, 0) / catSamples.length : 0;
        const subUsualSum = subList.reduce((acc, sub) => acc + sub.usual, 0);
        const diffUsual = Math.max(0, catUsual - subUsualSum);
        const pct = diffUsual > 0 ? (diffNow - diffUsual) / diffUsual : null;
        subList.push({
          id: `unassigned-${cat.id}`,
          name: "Sin subcategoría",
          now: diffNow,
          usual: diffUsual,
          pct,
        });
      }

      map.set(cat.id, subList);
    });
    return map;
  }, [expenseCategories, subcategories, bySubMonth, byCatMonth, allMonths, currentKey]);

  // La misma escala para todas las barras: si Comida es el triple, se ve el triple
  const budgetMax = Math.max(1, ...budget.map((r) => Math.max(r.now, r.usual))) * 1.08;

  // Resumen del mes (sobre TODAS las categorías, no solo las diez dibujadas)
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const monthTotal = personalTransactions
    .filter((transaction) => transaction.amount < 0 && transaction.transaction_date.startsWith(currentKey))
    .reduce((total, transaction) => total + Math.abs(transaction.amount), 0);
  const usualFullMonth = budgetAll.reduce((s, r) => s + r.usual, 0);
  const usualToDate = usualFullMonth * (now.getDate() / daysInMonth);
  const heroPct = usualToDate > 0 ? (monthTotal - usualToDate) / usualToDate : null;
  const monthIncome = byIncomeMonth.get(currentKey) ?? 0;
  const monthNet = monthIncome - monthTotal;

  const lastEntries = useMemo(
    () =>
      [...personalTransactions]
        .sort((a, b) => b.transaction_date.localeCompare(a.transaction_date) || (b.created_at ?? "").localeCompare(a.created_at ?? ""))
        .slice(0, 4),
    [personalTransactions],
  );

  if (!personalTransactions.length) {
    return (
      <div className="evo">
        <div className="evo-head"><h1>Tu historia empieza aquí</h1><p>Aún no hay nada anotado.</p></div>
        <div className="empty-state"><p>Añade tu primer apunte y aquí verás cómo se mueve tu dinero mes a mes.</p><AppLink className="button primary" href="/movimientos/nuevo">Anotar un movimiento</AppLink></div>
      </div>
    );
  }

  return (
    <div className="evo">
      <div className="evo-head">
        <h1>A día {now.getDate()} de {MES_LARGO[now.getMonth()]} llevas...</h1>
      </div>

      {/* CONCEPTO 7: Resumen Tríptico Ultra Claro y Simple */}
      <div className="concept7-hero-strip">

        <div className="c7-grid">
          <div className="c7-card primary">
            <div className="c7-lbl-group">
              <span className="c7-lbl">Gastos del mes</span>
              {heroPct !== null ? (
                <span className={`c7-pill ${heroPct > 0 ? "up" : "down"}`}>
                  {heroPct > 0 ? "+" : ""}{Math.round(heroPct * 100)}% {heroPct > 0 ? "más" : "menos"} de lo habitual
                </span>
              ) : null}
            </div>
            <strong className="c7-val expense">{formatCurrency(monthTotal)}</strong>
          </div>

          <div className="c7-card">
            <span className="c7-lbl">Ingresos</span>
            <strong className="c7-val income">+{formatCurrency(monthIncome)}</strong>
          </div>

          <div className="c7-card">
            <span className="c7-lbl">Balance Neto</span>
            <strong className={`c7-val ${monthNet >= 0 ? "positive" : "negative"}`}>
              {monthNet >= 0 ? "+" : ""}{formatCurrency(monthNet)}
            </strong>
          </div>
        </div>
      </div>

      {/* Selector Compacto del Concepto 4 (Conservado a petición del usuario) */}
      <div className="concept4-selector-card">
        <div className="c4-selector-head">
          <div className="c4-head-left">
            <h2>Categorías en la gráfica</h2>
            <span className="c4-head-sub">{selected.length} activas · Toca para filtrar</span>
          </div>
          <div className="c4-head-actions">
            <button
              type="button"
              className="c4-mini-btn"
              onClick={() => {
                const active = expenseCategories.filter((c) => (byCatMonth.get(c.id)?.get(currentKey) ?? 0) > 0).map((c) => c.id);
                setSelected(active.length ? active : expenseCategories.map((c) => c.id));
              }}
            >
              Con gasto
            </button>
            <button
              type="button"
              className="c4-mini-btn"
              onClick={() => setSelected(expenseCategories.map((c) => c.id))}
            >
              Todas
            </button>
            <button
              type="button"
              className="c4-mini-btn"
              onClick={() => setSelected([])}
            >
              Borrar
            </button>
          </div>
        </div>

        {/* Micro-cuadrícula compacta */}
        <div className="c4-micro-grid">
          {expenseCategories.map((c) => {
            const idx = selected.indexOf(c.id);
            const on = idx >= 0;
            const pen = on ? penFor(idx) : null;
            const catNow = byCatMonth.get(c.id)?.get(currentKey) ?? 0;
            return (
              <button
                type="button"
                key={c.id}
                className={`c4-micro-tile ${on ? "on" : ""} ${catNow > 0 ? "has-spend" : ""}`}
                onClick={() => toggle(c.id)}
                aria-pressed={on}
                style={on && pen ? { borderColor: pen.color } : undefined}
              >
                <span className="c4-dot" style={{ backgroundColor: on && pen ? pen.color : "var(--pencil-faint)" }} />
                <span className="c4-name">{c.name}</span>
                <span className="c4-val">{catNow > 0 ? formatCurrency(catNow) : "0 €"}</span>
              </button>
            );
          })}

          <button
            type="button"
            className={`c4-micro-tile income-tile ${incomeSelected ? "on" : ""}`}
            onClick={toggleIncome}
            aria-pressed={incomeSelected}
          >
            <span className="c4-dot income-dot-bg" />
            <span className="c4-name income-txt">Ingresos totales</span>
            <span className="c4-val income-txt">{formatCurrency(monthIncome)}</span>
          </button>
        </div>

        {/* Desglose de subcategorías */}
        {drillSubs.length ? (
          <div className="c4-sub-panel">
            <span className="c4-sub-lbl">Subcategorías de <strong>{categoryName.get(selected[0])}</strong>:</span>
            <div className="c4-sub-chips">
              {drillSubs.map((s) => {
                const idx = subSelected.indexOf(s.id);
                const on = idx >= 0;
                const pen = on ? penFor(selected.length + idx) : null;
                const subNow = bySubMonth.get(s.id)?.get(currentKey) ?? 0;
                return (
                  <button
                    type="button"
                    key={s.id}
                    className={`c4-sub-btn ${on ? "on" : ""}`}
                    onClick={() => toggleSub(s.id)}
                    aria-pressed={on}
                    style={on && pen ? { borderColor: pen.color } : undefined}
                  >
                    <span className="c4-sub-name">{s.name}</span>
                    <span className="c4-sub-val">{subNow > 0 ? formatCurrency(subNow) : "0 €"}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>

      <div className="range-row">
        <span className="lbl">Meses:</span>
        {rangeOptions.map((o) => (
          <button type="button" key={o.label} className={`range-btn ${range === o.value ? "on" : ""}`} onClick={() => pickRange(o.value)}>{o.label}</button>
        ))}
      </div>

      <div className="chart-card">
        {series.length && n > 0 ? (
          <>
            <div className="chart-hover-header">
              <div className="hover-info">
                <div className="month-nav-controls">
                  <button
                    type="button"
                    className="month-nav-btn"
                    disabled={hi === null || hi <= 0}
                    onClick={() => setHover(hi !== null ? Math.max(0, hi - 1) : 0)}
                    aria-label="Mes anterior"
                    title="Mes anterior"
                  >
                    <ChevronLeft size={16} />
                  </button>

                  <span className="hover-month-badge">
                    {hi !== null && visibleMonths[hi] ? monthLabel(visibleMonths[hi], true) : "—"}
                  </span>

                  <button
                    type="button"
                    className="month-nav-btn"
                    disabled={hi === null || hi >= n - 1}
                    onClick={() => setHover(hi !== null ? Math.min(n - 1, hi + 1) : n - 1)}
                    aria-label="Mes siguiente"
                    title="Mes siguiente"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>

                <div className="hover-series-list">
                  {hi !== null && visibleMonths[hi] ? (
                    roughSeries.map((s) => {
                      const isDimmed = activeSeriesId !== null && activeSeriesId !== s.id;
                      const isHighlighted = activeSeriesId === s.id;
                      return (
                        <div
                          key={s.id}
                          className={`hover-series-item ${s.kind} ${isHighlighted ? "highlighted" : ""}`}
                          style={{ opacity: isDimmed ? 0.3 : 1 }}
                          onMouseEnter={() => setActiveSeriesId(s.id)}
                          onMouseLeave={() => setActiveSeriesId(null)}
                        >
                          <span className="stroke-icon" style={{ borderTopColor: s.pen.color, borderTopStyle: s.pen.dashed ? "dashed" : "solid" }} />
                          <span className="series-name">{s.name}:</span>
                          <strong className="series-amount" style={{ color: s.pen.color }}>{s.kind === "income" ? "+" : ""}{formatCurrency(s.points[hi])}</strong>
                        </div>
                      );
                    })
                  ) : null}
                </div>
              </div>

              <div className="month-selector-bar">
                {visibleMonths.map((mk, idx) => {
                  const isSelected = hi === idx;
                  return (
                    <button
                      key={mk}
                      type="button"
                      className={`month-pill ${isSelected ? "active" : ""}`}
                      onClick={() => setHover(idx)}
                    >
                      {monthLabel(mk, mk.endsWith("-01") || idx === 0)}
                    </button>
                  );
                })}
              </div>
            </div>

            <svg
              ref={svgRef}
              className={`evo-chart ${compact ? "compact" : ""}`}
              viewBox={`0 0 ${W} ${H}`}
              role="img"
              aria-label="Evolución de los gastos e ingresos seleccionados"
              onPointerMove={onMove}
              onPointerDown={onMove}
              onTouchStart={onTouch}
              onTouchMove={onTouch}
            >
              <g>
                {yTicks.map((v, ti) => (
                  <path key={`g${v}`} d={roughPath([[padL, yAt(v)], [padL + plotW, yAt(v)]], mulberry32(31 + ti * 13), 1)} fill="none" stroke="#cfc7b2" strokeWidth={1.2} strokeDasharray="2 6" />
                ))}
                <path d={roughAxis} fill="none" stroke="#24211a" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
                {roughSeries.map((s) => {
                  const isDimmed = activeSeriesId !== null && activeSeriesId !== s.id;
                  const isHighlighted = activeSeriesId === s.id;
                  return (
                    <path
                      className={s.kind === "income" ? "income-series" : undefined}
                      key={s.id}
                      d={s.d}
                      fill="none"
                      stroke={s.pen.color}
                      strokeWidth={isHighlighted ? 4.8 : s.kind === "income" ? (compact ? 4 : 3.4) : (compact ? 3.4 : 2.8)}
                      opacity={isDimmed ? 0.2 : 1}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeDasharray={s.pen.dashed ? "9 6" : undefined}
                      style={{ transition: "opacity 0.2s ease, stroke-width 0.2s ease" }}
                      onMouseEnter={() => setActiveSeriesId(s.id)}
                      onMouseLeave={() => setActiveSeriesId(null)}
                    />
                  );
                })}
                {roughSeries.map((s) => {
                  const isDimmed = activeSeriesId !== null && activeSeriesId !== s.id;
                  return s.pts.map(([cx, cy], i) => (
                    <circle
                      key={`${s.id}-${i}`}
                      cx={cx}
                      cy={cy}
                      r={compact ? 3.6 : 2.7}
                      fill={s.pen.color}
                      opacity={isDimmed ? 0.2 : 1}
                      style={{ transition: "opacity 0.2s ease" }}
                    />
                  ));
                })}
                {hi !== null ? <line x1={xAt(hi)} y1={padT} x2={xAt(hi)} y2={padT + plotH} stroke="#24211a" strokeWidth={1.4} strokeDasharray="3 4" /> : null}
                {hi !== null ? roughSeries.map((s) => {
                  const isDimmed = activeSeriesId !== null && activeSeriesId !== s.id;
                  return (
                    <circle
                      key={`hi-${s.id}`}
                      cx={s.pts[hi][0]}
                      cy={s.pts[hi][1]}
                      r={compact ? 6.5 : 5}
                      fill="none"
                      stroke={s.pen.color}
                      strokeWidth={2}
                      opacity={isDimmed ? 0.2 : 1}
                    />
                  );
                }) : null}
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
                {endLabels.map((l) => {
                  const isDimmed = activeSeriesId !== null && activeSeriesId !== l.id;
                  const isHighlighted = activeSeriesId === l.id;
                  const labelX = padL + plotW + (compact ? 6 : 8);
                  const needLeader = Math.abs(l.y - l.origY) > 3;
                  const isDense = roughSeries.length > 5;
                  const bH = compact ? (isDense ? 14 : 16) : (isDense ? 16 : 18);
                  const bW = compact ? (isDense ? 68 : 74) : (isDense ? 95 : 105);
                  const fontSz = compact ? (isDense ? "9.5px" : "11px") : (isDense ? "11px" : "12.5px");

                  return (
                    <g
                      key={`lab${l.id}`}
                      opacity={isDimmed ? 0.25 : 1}
                      style={{ cursor: "pointer", transition: "opacity 0.2s ease" }}
                      onMouseEnter={() => setActiveSeriesId(l.id)}
                      onMouseLeave={() => setActiveSeriesId(null)}
                    >
                      {needLeader ? (
                        <line
                          x1={padL + plotW}
                          y1={l.origY}
                          x2={labelX - 2}
                          y2={l.y}
                          stroke={l.color}
                          strokeWidth={1}
                          strokeDasharray="2 2"
                        />
                      ) : null}
                      <rect
                        x={labelX}
                        y={l.y - bH / 2}
                        width={bW}
                        height={bH}
                        rx={4}
                        fill="var(--paper-solid)"
                        stroke={l.color}
                        strokeWidth={isHighlighted ? 2 : 1.2}
                      />
                      <text
                        key={`lab${l.id}`}
                        className="series-lab"
                        x={labelX + 4}
                        y={l.y + (compact ? 3.5 : 4)}
                        style={{ fill: l.color, fontWeight: isHighlighted ? 800 : 700, fontSize: fontSz }}
                      >
                        {l.name}
                      </text>
                    </g>
                  );
                })}
              </g>
            </svg>
          </>
        ) : (
          <div className="chart-empty">Marca un gasto o los ingresos para dibujar su evolución.</div>
        )}
      </div>

      <div className="hand-rule" />

      <p className="section-title">Este mes, por categoría</p>
      <p className="section-sub">Cuánto llevas de cada una comparado con lo que sueles gastar. Abre la flecha para ver subcategorías o toca un nombre para consultar sus apuntes.</p>
      <div className="budget-list">
        {budget.map((r, i) => {
          const nowW = Math.min(100, (r.now / budgetMax) * 100);
          const usualPos = Math.min(100, (r.usual / budgetMax) * 100);
          const over = r.pct !== null && r.pct > 0.05;
          const under = r.pct !== null && r.pct < -0.05;
          const subs = categorySubcategories.get(r.id) ?? [];
          const isExpanded = Boolean(expandedCats[r.id]);
          const hasSubs = subs.length > 0;

          return (
            <div className={`budget-row-container ${isExpanded ? "expanded" : ""}`} key={r.id}>
              <div className="budget-row">
                <div className="budget-top">
                  <div className="budget-title-group">
                    {hasSubs ? (
                      <button
                        type="button"
                        className={`expand-btn ${isExpanded ? "open" : ""}`}
                        onClick={() => setExpandedCats((prev) => ({ ...prev, [r.id]: !prev[r.id] }))}
                        aria-label={isExpanded ? `Cerrar subcategorías de ${r.name}` : `Abrir subcategorías de ${r.name}`}
                        title={isExpanded ? "Contraer subcategorías" : "Desglosar en subcategorías"}
                      >
                        {isExpanded ? <ChevronDown size={15} strokeWidth={2.5} /> : <ChevronRight size={15} strokeWidth={2.5} />}
                      </button>
                    ) : null}
                    <AppLink
                      className="name"
                      href={`/movimientos?month=${currentKey}&category=${encodeURIComponent(r.id)}`}
                      title={`Ver los apuntes de ${r.name} de este mes`}
                    >
                      {r.name}
                    </AppLink>
                    {hasSubs ? (
                      <button
                        type="button"
                        className="sub-count-tag"
                        onClick={() => setExpandedCats((prev) => ({ ...prev, [r.id]: !prev[r.id] }))}
                        title={isExpanded ? "Contraer subcategorías" : "Desglosar en subcategorías"}
                      >
                        ({subs.length} subcat)
                      </button>
                    ) : null}
                  </div>
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

              {isExpanded && hasSubs ? (
                <div className="budget-sublist">
                  {subs.map((sub) => {
                    const subNowW = Math.min(100, (sub.now / budgetMax) * 100);
                    const subUsualPos = Math.min(100, (sub.usual / budgetMax) * 100);
                    const subOver = sub.pct !== null && sub.pct > 0.05;
                    const subUnder = sub.pct !== null && sub.pct < -0.05;
                    return (
                      <div className="budget-subrow" key={sub.id}>
                        <div className="subrow-tree">└</div>
                        <div className="subrow-content">
                          <div className="budget-top">
                            <AppLink
                              className="sub-name"
                              href={`/movimientos?month=${currentKey}&category=${encodeURIComponent(r.id)}&subcategory=${encodeURIComponent(sub.id.startsWith("unassigned-") ? "none" : sub.id)}`}
                              title={`Ver los apuntes de ${sub.name} de este mes`}
                            >
                              {sub.name}
                            </AppLink>
                            <span className={`note small ${subOver ? "over" : subUnder ? "under" : ""}`}>
                              {sub.pct === null ? "" : Math.abs(sub.pct) < 0.05 ? "≈ normal" : `${sub.pct > 0 ? "+" : ""}${Math.round(sub.pct * 100)}%`}
                            </span>
                          </div>
                          <div className="budget-track sub">
                            <span className="base" />
                            <span className="fill sub" style={{ width: `${Math.max(1, subNowW)}%` }} />
                            {sub.usual > 0 ? <span className="usual" style={{ left: `${subUsualPos}%` }} /> : null}
                          </div>
                          <div className="budget-amt sub">
                            <span className="now">{formatCurrency(sub.now)}</span>
                            {sub.usual > 0 ? <span className="of">de ~{formatCurrency(sub.usual)} hab.</span> : null}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : null}
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
        <AppLink className="see-all" href="/movimientos">ver todos los apuntes →</AppLink>
      </div>
    </div>
  );
}
