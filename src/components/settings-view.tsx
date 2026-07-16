"use client";

import { Plus } from "lucide-react";
import { useState } from "react";
import { useFinance } from "@/components/finance-provider";
import { PageHeader } from "@/components/page-header";
import { getSupabase } from "@/lib/supabase";

export function SettingsView() {
  const { categories, subcategories, session, refresh } = useFinance();
  const supabase = getSupabase();
  const [newCategory, setNewCategory] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  async function addCategory() {
    if (!supabase || !session || !newCategory.trim()) return;
    const { error } = await supabase.from("categories").insert({ user_id: session.user.id, name: newCategory.trim(), sort_order: categories.length, is_active: true });
    if (error) setMessage(error.message);
    else { setNewCategory(""); setMessage("Categoría añadida."); await refresh(); }
  }

  async function toggleCategory(id: string, active: boolean) {
    if (!supabase) return;
    const { error } = await supabase.from("categories").update({ is_active: !active }).eq("id", id);
    if (error) setMessage(error.message);
    else await refresh();
  }

  return (
    <div className="page" style={{ maxWidth: 620 }}>
      <PageHeader eyebrow="" title="Ajustes" description="Tus categorías, como las tendrías en la libreta." />
      <div className="toolbar">
        <div className="field" style={{ flex: 1 }}>
          <input
            value={newCategory}
            onChange={(event) => setNewCategory(event.target.value)}
            onKeyDown={(event) => { if (event.key === "Enter") void addCategory(); }}
            placeholder="Nueva categoría…"
            aria-label="Nueva categoría"
          />
        </div>
        <button className="button primary" onClick={() => void addCategory()}><Plus size={15} />Añadir</button>
      </div>
      <div className="last-list">
        {categories.map((category) => {
          const count = subcategories.filter((item) => item.category_id === category.id).length;
          return (
            <div className="last-row" key={category.id}>
              <span className="what" style={{ opacity: category.is_active ? 1 : 0.45 }}>{category.name}</span>
              <span className="when">{count ? `${count} subcategorías` : ""}</span>
              <button className={`badge ${category.is_active ? "" : "red"}`} style={{ cursor: "pointer" }} onClick={() => void toggleCategory(category.id, category.is_active)}>
                {category.is_active ? "activa" : "tachada"}
              </button>
            </div>
          );
        })}
      </div>
      <p className="section-sub" style={{ marginTop: 14 }}>
        Una categoría tachada no sale al anotar ni en el resumen, pero sus apuntes antiguos se conservan.
      </p>
      {message ? <p className="notice success" style={{ marginTop: 10 }}>{message}</p> : null}
    </div>
  );
}
