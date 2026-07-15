"use client";

import { CircleAlert, LoaderCircle, Save } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useFinance } from "@/components/finance-provider";
import { PageHeader } from "@/components/page-header";
import { calculateDepreciation } from "@/lib/calculations";
import { formatCurrency, todayIso } from "@/lib/format";
import { getSupabase } from "@/lib/supabase";

type AssetRow = { id: string; name: string; cost: number; acquisition_date: string; annual_rate: number; business_use_percentage: number };

export function AssetsView() {
  const { transactions, properties, session } = useFinance();
  const supabase = getSupabase();
  const [name, setName] = useState("");
  const [cost, setCost] = useState(1000);
  const [date, setDate] = useState(todayIso());
  const [rate, setRate] = useState(10);
  const [businessUse, setBusinessUse] = useState(100);
  const [assets, setAssets] = useState<AssetRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const candidates = useMemo(() => transactions.filter((row) => /aire acondicionado|cerradura/i.test(row.name) || /inmovilizado|mejora/i.test(row.fiscal_property_status ?? "")), [transactions]);
  const schedule = useMemo(() => calculateDepreciation({ cost, annualRate: rate / 100, businessUsePercentage: businessUse / 100, startDate: date }), [businessUse, cost, date, rate]);

  useEffect(() => {
    if (!supabase || !session) return;
    let active = true;
    supabase.from("assets").select("id,name,cost,acquisition_date,annual_rate,business_use_percentage").order("acquisition_date", { ascending: false }).then(({ data }) => {
      if (active) setAssets((data ?? []) as AssetRow[]);
    });
    return () => { active = false; };
  }, [session, supabase]);

  function loadCandidate(id: string) {
    const row = candidates.find((item) => item.id === id);
    if (!row) return;
    setName(row.name);
    setCost(Math.abs(row.amount));
    setDate(row.transaction_date);
  }

  async function save() {
    if (!supabase || !session || !name.trim()) return;
    setSaving(true); setMessage(null);
    const property = properties.find((item) => item.name === "Piso Málaga");
    const linked = candidates.find((item) => item.name === name && item.transaction_date === date);
    const { data, error } = await supabase.from("assets").insert({
      user_id: session.user.id,
      property_id: property?.id ?? null,
      linked_transaction_id: linked?.id ?? null,
      name: name.trim(),
      asset_type: "property_improvement",
      acquisition_date: date,
      cost,
      amortization_method: "straight_line",
      annual_rate: rate / 100,
      business_use_percentage: businessUse / 100,
      start_date: date,
      residual_value: 0,
      notes: "Tasa y afectación configuradas manualmente; pendiente de validación fiscal.",
    }).select("id,name,cost,acquisition_date,annual_rate,business_use_percentage").single();
    if (!error && data) {
      await supabase.from("asset_depreciation_entries").insert(schedule.map((entry) => ({
        asset_id: data.id,
        user_id: session.user.id,
        fiscal_year: entry.fiscalYear,
        opening_basis: entry.openingBasis,
        annual_depreciation: entry.annualDepreciation,
        accumulated_depreciation: entry.accumulatedDepreciation,
        pending_value: entry.pendingValue,
      })));
      setAssets((current) => [data as AssetRow, ...current]);
      setMessage("Activo guardado con su cuadro anual.");
    } else setMessage(error?.message ?? "No se pudo guardar.");
    setSaving(false);
  }

  return (
    <div className="page">
      <PageHeader eyebrow="Revisión fiscal" title="Inmovilizado y amortización" description="Calculadora lineal prorrateada por días naturales. La tasa y el porcentaje de uso son editables y no constituyen una conclusión fiscal." />
      <section className="grid two-column">
        <article className="card">
          <div className="card-header"><div><h2>Parámetros del activo</h2><p>Selecciona un candidato o introduce uno nuevo</p></div></div>
          <div className="card-body form-grid">
            <div className="field full"><label>Candidatos detectados</label><select onChange={(event) => loadCandidate(event.target.value)} defaultValue=""><option value="">Seleccionar…</option>{candidates.map((row) => <option value={row.id} key={row.id}>{row.name} · {formatCurrency(row.amount)}</option>)}</select></div>
            <div className="field full"><label>Nombre del activo</label><input value={name} onChange={(event) => setName(event.target.value)} placeholder="Aire acondicionado" /></div>
            <div className="field"><label>Coste (€)</label><input type="number" min="0" step="0.01" value={cost} onChange={(event) => setCost(Number(event.target.value))} /></div>
            <div className="field"><label>Fecha de adquisición</label><input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></div>
            <div className="field"><label>Tasa anual (%)</label><input type="number" min="0" max="100" step="0.01" value={rate} onChange={(event) => setRate(Number(event.target.value))} /></div>
            <div className="field"><label>Uso afecto (%)</label><input type="number" min="0" max="100" step="0.01" value={businessUse} onChange={(event) => setBusinessUse(Number(event.target.value))} /></div>
          </div>
          <div className="card-body" style={{ paddingTop: 0 }}><button className="button primary" onClick={() => void save()} disabled={saving || !name.trim()}>{saving ? <LoaderCircle className="spin" size={16} /> : <Save size={16} />}Guardar activo</button>{message ? <p className="notice">{message}</p> : null}</div>
        </article>
        <article className="card">
          <div className="card-header"><div><h2>Cuadro anual</h2><p>Prorrateo diario en el primer ejercicio</p></div></div>
          <div className="card-body calculator-results">
            {schedule.map((entry) => <div className="result-row" key={entry.fiscalYear}><span><strong>{entry.fiscalYear}</strong><small style={{ display: "block" }}>Base {formatCurrency(entry.openingBasis)}</small></span><span style={{ textAlign: "right" }}>Año <strong>{formatCurrency(entry.annualDepreciation)}</strong><small style={{ display: "block" }}>Pendiente {formatCurrency(entry.pendingValue)}</small></span></div>)}
          </div>
        </article>
      </section>
      <div style={{ height: 18 }} />
      <article className="card"><div className="card-header"><div><h2>Activos guardados</h2><p>{assets.length} elementos confirmados manualmente</p></div></div><div className="card-body">{assets.length ? <div className="calculator-results">{assets.map((asset) => <div className="result-row" key={asset.id}><span>{asset.name}<small style={{ display: "block" }}>{asset.acquisition_date} · {(asset.annual_rate * 100).toLocaleString("es-ES")}%</small></span><strong>{formatCurrency(Number(asset.cost))}</strong></div>)}</div> : <p className="notice"><CircleAlert size={14} style={{ display: "inline", marginRight: 6 }} />Aire acondicionado y cerradura aparecen como candidatos, pero no se crean activos sin confirmación.</p>}</div></article>
    </div>
  );
}
