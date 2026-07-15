"use client";

import { Check, Database, Plus, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { useFinance } from "@/components/finance-provider";
import { PageHeader } from "@/components/page-header";
import { getSupabase } from "@/lib/supabase";

type Settings = {
  airbnb_cleaning_fee: number;
  airbnb_platform_rate: number;
  booking_cleaning_fee: number;
  booking_platform_rate: number;
  booking_bank_rate: number;
  manager_rate: number;
};

const defaults: Settings = { airbnb_cleaning_fee: 60, airbnb_platform_rate: 0.18755, booking_cleaning_fee: 70, booking_platform_rate: 0.15, booking_bank_rate: 0.013, manager_rate: 0.18 };

export function SettingsView() {
  const { categories, subcategories, accounts, session, refresh } = useFinance();
  const supabase = getSupabase();
  const [newCategory, setNewCategory] = useState("");
  const [settings, setSettings] = useState<Settings>(defaults);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase || !session) return;
    supabase.from("app_settings").select("airbnb_cleaning_fee,airbnb_platform_rate,booking_cleaning_fee,booking_platform_rate,booking_bank_rate,manager_rate").single().then(({ data }) => { if (data) setSettings(data as Settings); });
  }, [session, supabase]);

  async function addCategory() {
    if (!supabase || !session || !newCategory.trim()) return;
    const { error } = await supabase.from("categories").insert({ user_id: session.user.id, name: newCategory.trim(), sort_order: categories.length, is_active: true });
    if (error) setMessage(error.message); else { setNewCategory(""); setMessage("Categoría creada."); await refresh(); }
  }

  async function toggleCategory(id: string, active: boolean) {
    if (!supabase) return;
    const { error } = await supabase.from("categories").update({ is_active: !active }).eq("id", id);
    if (error) setMessage(error.message); else await refresh();
  }

  async function saveSettings() {
    if (!supabase || !session) return;
    const { error } = await supabase.from("app_settings").upsert({ user_id: session.user.id, ...settings });
    setMessage(error?.message ?? "Preferencias guardadas.");
  }

  return (
    <div className="page">
      <PageHeader eyebrow="Configuración" title="Ajustes" description="Taxonomía editable, cuenta principal y valores predeterminados de las calculadoras." />
      <section className="grid two-column">
        <article className="card">
          <div className="card-header"><div><h2>Categorías</h2><p>{categories.length} principales y {subcategories.length} subcategorías</p></div></div>
          <div className="card-body">
            <div className="toolbar"><input className="select-field" value={newCategory} onChange={(event) => setNewCategory(event.target.value)} placeholder="Nueva categoría" /><button className="button primary" onClick={() => void addCategory()}><Plus size={15} />Añadir</button></div>
            <div className="settings-list">
              {categories.map((category) => {
                const count = subcategories.filter((item) => item.category_id === category.id).length;
                return <div className="result-row" key={category.id}><span><strong>{category.name}</strong><small style={{ display: "block" }}>{count} subcategorías</small></span><button className={`badge ${category.is_active ? "" : "red"}`} onClick={() => void toggleCategory(category.id, category.is_active)}>{category.is_active ? "Activa" : "Inactiva"}</button></div>;
              })}
            </div>
          </div>
        </article>
        <div className="grid">
          <article className="card">
            <div className="card-header"><div><h2>Valores por defecto</h2><p>Editables en cada reserva</p></div></div>
            <div className="card-body form-grid">
              <div className="field"><label>Limpieza Airbnb (€)</label><input type="number" value={settings.airbnb_cleaning_fee} onChange={(event) => setSettings({ ...settings, airbnb_cleaning_fee: Number(event.target.value) })} /></div>
              <div className="field"><label>Tasa efectiva Airbnb (%)</label><input type="number" step="0.001" value={settings.airbnb_platform_rate * 100} onChange={(event) => setSettings({ ...settings, airbnb_platform_rate: Number(event.target.value) / 100 })} /></div>
              <div className="field"><label>Limpieza Booking (€)</label><input type="number" value={settings.booking_cleaning_fee} onChange={(event) => setSettings({ ...settings, booking_cleaning_fee: Number(event.target.value) })} /></div>
              <div className="field"><label>Comisión Booking (%)</label><input type="number" step="0.001" value={settings.booking_platform_rate * 100} onChange={(event) => setSettings({ ...settings, booking_platform_rate: Number(event.target.value) / 100 })} /></div>
              <div className="field"><label>Cargo bancario (%)</label><input type="number" step="0.001" value={settings.booking_bank_rate * 100} onChange={(event) => setSettings({ ...settings, booking_bank_rate: Number(event.target.value) / 100 })} /></div>
              <div className="field"><label>Comisión gestora (%)</label><input type="number" step="0.001" value={settings.manager_rate * 100} onChange={(event) => setSettings({ ...settings, manager_rate: Number(event.target.value) / 100 })} /></div>
            </div>
            <div className="card-body" style={{ paddingTop: 0 }}><button className="button primary" onClick={() => void saveSettings()}><Check size={15} />Guardar preferencias</button></div>
          </article>
          <article className="card"><div className="card-body"><div className="stat-strip"><span><Database size={14} style={{ display: "inline", marginRight: 5 }} />Cuenta por defecto<strong>{accounts.find((item) => item.is_default)?.name ?? accounts[0]?.name ?? "Sin cuenta"}</strong></span><span><ShieldCheck size={14} style={{ display: "inline", marginRight: 5 }} />Seguridad<strong>RLS activa</strong></span></div><p className="notice success">La aplicación usa únicamente la clave pública. La clave de servicio no se expone en el cliente.</p></div></article>
        </div>
      </section>
      {message ? <p className="notice success">{message}</p> : null}
    </div>
  );
}
