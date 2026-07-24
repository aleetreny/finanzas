"use client";

import { Check, ChevronDown, ChevronUp, KeyRound, Pencil, Plus, Smartphone, Trash2, X } from "lucide-react";
import { useState, type FormEvent } from "react";
import { AppLink } from "@/components/app-link";
import { useFinance } from "@/components/finance-provider";
import { PageHeader } from "@/components/page-header";
import { getSupabase } from "@/lib/supabase";
import type { Category, CategoryScope, Subcategory } from "@/lib/types";

const SCOPE_LABELS: Record<CategoryScope, string> = {
  expense: "Gastos generales",
  income: "Ingresos",
  property: "Piso Málaga",
};

function readableError(message: string) {
  if (message.includes("categories_name_per_user")) return "Ya existe una categoría con ese nombre.";
  if (message.includes("subcategories_name_per_category")) return "Esa subcategoría ya existe aquí.";
  return message;
}

export function SettingsView() {
  const { categories, hasMalagaAccess, subcategories, session, refresh, updatePassword } = useFinance();
  const supabase = getSupabase();
  const [newCategory, setNewCategory] = useState("");
  const [newCategoryScope, setNewCategoryScope] = useState<CategoryScope>("expense");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [categoryName, setCategoryName] = useState("");
  const [categoryScope, setCategoryScope] = useState<CategoryScope>("expense");
  const [newSubcategory, setNewSubcategory] = useState("");
  const [editingSubcategoryId, setEditingSubcategoryId] = useState<string | null>(null);
  const [subcategoryName, setSubcategoryName] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [messageType, setMessageType] = useState<"success" | "error">("success");
  const [accessPassword, setAccessPassword] = useState("");
  const [accessPasswordRepeat, setAccessPasswordRepeat] = useState("");
  const [accessBusy, setAccessBusy] = useState(false);
  const [accessMessage, setAccessMessage] = useState<string | null>(null);
  const [accessError, setAccessError] = useState<string | null>(null);

  function showMessage(text: string, type: "success" | "error" = "success") {
    setMessage(text);
    setMessageType(type);
  }

  async function saveAccessPassword(event: FormEvent) {
    event.preventDefault();
    setAccessMessage(null);
    setAccessError(null);
    if (accessPassword.length < 10) {
      setAccessError("La clave debe tener al menos 10 caracteres.");
      return;
    }
    if (accessPassword !== accessPasswordRepeat) {
      setAccessError("Las dos claves no coinciden.");
      return;
    }
    setAccessBusy(true);
    try {
      await updatePassword(accessPassword);
      setAccessPassword("");
      setAccessPasswordRepeat("");
      setAccessMessage("Clave guardada. Ya puedes usarla para entrar con tu correo en cualquier dispositivo.");
    } catch (caught) {
      setAccessError(caught instanceof Error ? caught.message : "No se pudo guardar la clave.");
    } finally {
      setAccessBusy(false);
    }
  }

  async function mutate(success: string, operation: () => Promise<{ error: { message: string } | null }>) {
    setBusy(true);
    setMessage(null);
    try {
      const { error } = await operation();
      if (error) {
        showMessage(readableError(error.message), "error");
        return false;
      }
      await refresh();
      showMessage(success);
      return true;
    } catch (caught) {
      showMessage(caught instanceof Error ? caught.message : "No se pudo guardar el cambio.", "error");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function addCategory() {
    const name = newCategory.trim();
    if (!supabase || !session || !name) return;
    const saved = await mutate("Categoría añadida.", async () => {
      return supabase.from("categories").insert({
        user_id: session.user.id,
        name,
        category_scope: newCategoryScope,
        sort_order: categories.length,
        is_active: true,
      });
    });
    if (saved) setNewCategory("");
  }

  function startCategoryEdit(category: Category) {
    setEditingCategoryId(category.id);
    setCategoryName(category.name);
    setCategoryScope(category.category_scope);
  }

  async function saveCategory(id: string) {
    const name = categoryName.trim();
    if (!supabase || !name) return;
    const saved = await mutate("Categoría actualizada.", async () => {
      return supabase.from("categories").update({ name, category_scope: categoryScope }).eq("id", id);
    });
    if (saved) setEditingCategoryId(null);
  }

  async function toggleCategory(category: Category) {
    if (!supabase) return;
    await mutate(category.is_active ? "Categoría desactivada." : "Categoría activada.", async () => {
      return supabase.from("categories").update({ is_active: !category.is_active }).eq("id", category.id);
    });
  }

  async function deleteCategory(category: Category) {
    if (!supabase) return;
    const confirmed = window.confirm(
      `¿Eliminar “${category.name}” y todas sus subcategorías? Los apuntes históricos se conservarán, pero quedarán sin categoría.`,
    );
    if (!confirmed) return;
    const deleted = await mutate("Categoría eliminada.", async () => {
      return supabase.from("categories").delete().eq("id", category.id);
    });
    if (deleted && expandedId === category.id) setExpandedId(null);
  }

  async function addSubcategory(category: Category) {
    const name = newSubcategory.trim();
    if (!supabase || !session || !name) return;
    const siblings = subcategories.filter((item) => item.category_id === category.id);
    const saved = await mutate("Subcategoría añadida.", async () => {
      return supabase.from("subcategories").insert({
        user_id: session.user.id,
        category_id: category.id,
        name,
        sort_order: siblings.length,
        is_active: true,
      });
    });
    if (saved) setNewSubcategory("");
  }

  function startSubcategoryEdit(subcategory: Subcategory) {
    setEditingSubcategoryId(subcategory.id);
    setSubcategoryName(subcategory.name);
  }

  async function saveSubcategory(id: string) {
    const name = subcategoryName.trim();
    if (!supabase || !name) return;
    const saved = await mutate("Subcategoría actualizada.", async () => {
      return supabase.from("subcategories").update({ name }).eq("id", id);
    });
    if (saved) setEditingSubcategoryId(null);
  }

  async function toggleSubcategory(subcategory: Subcategory) {
    if (!supabase) return;
    await mutate(subcategory.is_active ? "Subcategoría desactivada." : "Subcategoría activada.", async () => {
      return supabase.from("subcategories").update({ is_active: !subcategory.is_active }).eq("id", subcategory.id);
    });
  }

  async function deleteSubcategory(subcategory: Subcategory) {
    if (!supabase || !window.confirm(`¿Eliminar la subcategoría “${subcategory.name}”?`)) return;
    await mutate("Subcategoría eliminada.", async () => {
      return supabase.from("subcategories").delete().eq("id", subcategory.id);
    });
  }

  return (
    <div className="page settings-page">
      <PageHeader
        eyebrow=""
        title="Ajustes"
        description="Gestiona tu acceso, la instalación y las categorías de tu libreta."
      />

      <section className="access-setup card">
        <div className="access-setup-copy">
          <span className="auth-icon"><KeyRound size={22} /></span>
          <div>
            <h2>Tu clave de acceso</h2>
            <p>
              Crea una clave privada una sola vez. Después entrarás con tu correo y esta clave, también desde el icono de la pantalla de inicio, sin volver a abrir el correo.
            </p>
          </div>
        </div>
        <form className="access-password-form" onSubmit={saveAccessPassword}>
          <div className="field">
            <label htmlFor="access-password">Nueva clave</label>
            <input
              id="access-password"
              type="password"
              value={accessPassword}
              onChange={(event) => setAccessPassword(event.target.value)}
              minLength={10}
              required
              autoComplete="new-password"
              placeholder="Mínimo 10 caracteres"
            />
          </div>
          <div className="field">
            <label htmlFor="access-password-repeat">Repite la clave</label>
            <input
              id="access-password-repeat"
              type="password"
              value={accessPasswordRepeat}
              onChange={(event) => setAccessPasswordRepeat(event.target.value)}
              minLength={10}
              required
              autoComplete="new-password"
              placeholder="La misma clave"
            />
          </div>
          <button className="button primary" type="submit" disabled={accessBusy || accessPassword.length < 10 || accessPassword !== accessPasswordRepeat}>
            {accessBusy ? "Guardando…" : "Guardar clave"}
          </button>
        </form>
        {accessMessage ? <p className="notice success" role="status">{accessMessage}</p> : null}
        {accessError ? <p className="notice error" role="alert">{accessError}</p> : null}
      </section>

      <section className="settings-install card">
        <span className="auth-icon"><Smartphone size={22} /></span>
        <div>
          <h2>Instalar en el móvil</h2>
          <p>Añade Mis gastos a la pantalla de inicio de iPhone o Android para abrirla como cualquier otra app.</p>
        </div>
        <AppLink href="/instalar" className="button">Ver instrucciones</AppLink>
      </section>

      <section className="settings-add card">
        <div className="field">
          <label htmlFor="new-category">Nueva categoría</label>
          <input
            id="new-category"
            value={newCategory}
            onChange={(event) => setNewCategory(event.target.value)}
            onKeyDown={(event) => { if (event.key === "Enter") void addCategory(); }}
            placeholder="Nombre de la categoría…"
          />
        </div>
        <div className="field">
          <label htmlFor="new-category-scope">Se usa para</label>
          <select
            id="new-category-scope"
            value={newCategoryScope}
            onChange={(event) => setNewCategoryScope(event.target.value as CategoryScope)}
          >
            {Object.entries(SCOPE_LABELS)
              .filter(([value]) => hasMalagaAccess || value !== "property")
              .map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </div>
        <button className="button primary" disabled={busy || !newCategory.trim()} onClick={() => void addCategory()}>
          <Plus size={16} />Añadir
        </button>
      </section>

      <div className="settings-categories">
        {categories
          .filter((category) => hasMalagaAccess || category.category_scope !== "property")
          .map((category) => {
          const children = subcategories.filter((item) => item.category_id === category.id);
          const expanded = expandedId === category.id;
          const editing = editingCategoryId === category.id;
          return (
            <section className="settings-category" key={category.id}>
              <div className="settings-category-main">
                <button
                  className="icon-button"
                  aria-label={expanded ? `Ocultar subcategorías de ${category.name}` : `Mostrar subcategorías de ${category.name}`}
                  onClick={() => {
                    setExpandedId(expanded ? null : category.id);
                    setNewSubcategory("");
                  }}
                >
                  {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                </button>

                {editing ? (
                  <div className="settings-inline-edit">
                    <input value={categoryName} onChange={(event) => setCategoryName(event.target.value)} aria-label="Nombre de categoría" autoFocus />
                    <select value={categoryScope} onChange={(event) => setCategoryScope(event.target.value as CategoryScope)} aria-label="Uso de la categoría">
                      {Object.entries(SCOPE_LABELS)
                        .filter(([value]) => hasMalagaAccess || value !== "property")
                        .map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </select>
                  </div>
                ) : (
                  <div className="settings-category-name" style={{ opacity: category.is_active ? 1 : 0.45 }}>
                    <strong>{category.name}</strong>
                    <span>{SCOPE_LABELS[category.category_scope]} · {children.length} {children.length === 1 ? "subcategoría" : "subcategorías"}</span>
                  </div>
                )}

                <div className="settings-actions">
                  {editing ? (
                    <>
                      <button className="icon-button" title="Guardar" aria-label="Guardar categoría" disabled={busy || !categoryName.trim()} onClick={() => void saveCategory(category.id)}><Check size={17} /></button>
                      <button className="icon-button" title="Cancelar" aria-label="Cancelar edición" onClick={() => setEditingCategoryId(null)}><X size={17} /></button>
                    </>
                  ) : (
                    <button className="icon-button" title="Editar" aria-label={`Editar ${category.name}`} onClick={() => startCategoryEdit(category)}><Pencil size={16} /></button>
                  )}
                  <button className={`badge ${category.is_active ? "" : "red"}`} disabled={busy} onClick={() => void toggleCategory(category)}>
                    {category.is_active ? "activa" : "inactiva"}
                  </button>
                  <button className="icon-button danger-icon" title="Eliminar" aria-label={`Eliminar ${category.name}`} disabled={busy} onClick={() => void deleteCategory(category)}><Trash2 size={16} /></button>
                </div>
              </div>

              {expanded ? (
                <div className="settings-subcategories">
                  {children.map((subcategory) => {
                    const editingSubcategory = editingSubcategoryId === subcategory.id;
                    return (
                      <div className="settings-subcategory" key={subcategory.id}>
                        {editingSubcategory ? (
                          <input value={subcategoryName} onChange={(event) => setSubcategoryName(event.target.value)} aria-label="Nombre de subcategoría" autoFocus />
                        ) : (
                          <span style={{ opacity: subcategory.is_active ? 1 : 0.45 }}>{subcategory.name}</span>
                        )}
                        <div className="settings-actions">
                          {editingSubcategory ? (
                            <>
                              <button className="icon-button" title="Guardar" aria-label="Guardar subcategoría" disabled={busy || !subcategoryName.trim()} onClick={() => void saveSubcategory(subcategory.id)}><Check size={16} /></button>
                              <button className="icon-button" title="Cancelar" aria-label="Cancelar edición" onClick={() => setEditingSubcategoryId(null)}><X size={16} /></button>
                            </>
                          ) : (
                            <button className="icon-button" title="Editar" aria-label={`Editar ${subcategory.name}`} onClick={() => startSubcategoryEdit(subcategory)}><Pencil size={15} /></button>
                          )}
                          <button className={`badge ${subcategory.is_active ? "" : "red"}`} disabled={busy} onClick={() => void toggleSubcategory(subcategory)}>
                            {subcategory.is_active ? "activa" : "inactiva"}
                          </button>
                          <button className="icon-button danger-icon" title="Eliminar" aria-label={`Eliminar ${subcategory.name}`} disabled={busy} onClick={() => void deleteSubcategory(subcategory)}><Trash2 size={15} /></button>
                        </div>
                      </div>
                    );
                  })}

                  <div className="settings-add-subcategory">
                    <input
                      value={newSubcategory}
                      onChange={(event) => setNewSubcategory(event.target.value)}
                      onKeyDown={(event) => { if (event.key === "Enter") void addSubcategory(category); }}
                      placeholder={`Nueva subcategoría de ${category.name}…`}
                      aria-label={`Nueva subcategoría de ${category.name}`}
                    />
                    <button className="button small" disabled={busy || !newSubcategory.trim()} onClick={() => void addSubcategory(category)}><Plus size={15} />Añadir</button>
                  </div>
                </div>
              ) : null}
            </section>
          );
        })}
      </div>

      <p className="section-sub settings-help">
        Al eliminar una categoría, sus apuntes no se borran: quedan sin categoría. Al eliminar una subcategoría, conservan su categoría principal.
      </p>
      {message ? <p className={`notice ${messageType}`} role="status">{message}</p> : null}
    </div>
  );
}
