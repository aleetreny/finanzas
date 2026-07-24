"use client";

import { CirclePause, CirclePlay, Pencil, Plus, Repeat2, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { AppModal } from "@/components/app-modal";
import { useFinance } from "@/components/finance-provider";
import { PageHeader } from "@/components/page-header";
import { RecurringForm } from "@/components/recurring-form";
import { formatCurrency, formatDate, roundMoney } from "@/lib/format";
import type { RecurringRule } from "@/lib/types";

const FREQUENCY_LABEL: Record<RecurringRule["frequency"], string> = {
  weekly: "Semanal",
  monthly: "Mensual",
  quarterly: "Trimestral",
  yearly: "Anual",
};

function monthlyEquivalent(rule: RecurringRule) {
  const amount = Number(rule.amount);
  if (rule.frequency === "weekly") return amount * 52 / 12;
  if (rule.frequency === "quarterly") return amount / 3;
  if (rule.frequency === "yearly") return amount / 12;
  return amount;
}

export function RecurringView() {
  const {
    categories,
    subcategories,
    recurringRules,
    deleteRecurring,
    toggleRecurring,
  } = useFinance();
  const [editing, setEditing] = useState<RecurringRule | null | "new">(null);
  const [actionId, setActionId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const categoryNames = useMemo(
    () => new Map(categories.map((category) => [category.id, category.name])),
    [categories],
  );
  const subcategoryNames = useMemo(
    () => new Map(subcategories.map((subcategory) => [subcategory.id, subcategory.name])),
    [subcategories],
  );
  const generalRules = useMemo(
    () => recurringRules
      .filter((rule) => {
        const category = categories.find((item) => item.id === rule.category_id);
        return category?.category_scope !== "property"
          && rule.context?.toLocaleLowerCase("es") !== "piso málaga";
      })
      .sort((left, right) =>
        Number(right.is_active) - Number(left.is_active)
        || left.name.localeCompare(right.name, "es")),
    [categories, recurringRules],
  );
  const monthlyIncome = roundMoney(generalRules
    .filter((rule) => rule.is_active && Number(rule.amount) > 0)
    .reduce((sum, rule) => sum + monthlyEquivalent(rule), 0));
  const monthlyExpense = roundMoney(Math.abs(generalRules
    .filter((rule) => rule.is_active && Number(rule.amount) < 0)
    .reduce((sum, rule) => sum + monthlyEquivalent(rule), 0)));

  async function toggle(rule: RecurringRule) {
    setActionError(null);
    setActionId(rule.id);
    try {
      await toggleRecurring(rule.id, !rule.is_active);
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : "No se pudo actualizar el recurrente.");
    } finally {
      setActionId(null);
    }
  }

  async function remove(rule: RecurringRule) {
    if (!window.confirm(`¿Eliminar “${rule.name}”? Los apuntes ya creados se conservarán.`)) return;
    setActionError(null);
    setActionId(rule.id);
    try {
      await deleteRecurring(rule.id);
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : "No se pudo eliminar el recurrente.");
    } finally {
      setActionId(null);
    }
  }

  return (
    <div className="page recurring-page">
      <PageHeader
        eyebrow="Automatización"
        title="Gastos e ingresos recurrentes"
        description="Programa nóminas, alquileres, suscripciones y cualquier apunte que se repita."
        action={<button className="button primary" type="button" onClick={() => setEditing("new")}><Plus size={17} />Nuevo recurrente</button>}
      />

      <section className="recurring-summary" aria-label="Equivalente mensual de reglas activas">
        <div><span>Ingresos al mes</span><strong className="positive">{formatCurrency(monthlyIncome)}</strong></div>
        <div><span>Gastos al mes</span><strong className={monthlyExpense ? "negative" : ""}>{formatCurrency(monthlyExpense ? -monthlyExpense : 0)}</strong></div>
        <div><span>Reglas activas</span><strong>{generalRules.filter((rule) => rule.is_active).length}</strong></div>
      </section>

      <p className="recurring-explanation">
        Al abrir la aplicación se crean los apuntes que ya hayan vencido, una sola vez por fecha. Puedes pausar una regla sin perder su historial.
      </p>
      {actionError ? <p className="notice error" role="alert">{actionError}</p> : null}

      {generalRules.length ? (
        <div className="recurring-rule-list">
          {generalRules.map((rule) => {
            const income = Number(rule.amount) >= 0;
            const category = categoryNames.get(rule.category_id ?? "") ?? "Sin categoría";
            const subcategory = subcategoryNames.get(rule.subcategory_id ?? "");
            return (
              <article className={`recurring-rule-card${rule.is_active ? "" : " paused"}`} key={rule.id}>
                <div className="recurring-rule-main">
                  <span className={`badge ${income ? "green" : ""}`}>{income ? "Ingreso" : "Gasto"}</span>
                  <div>
                    <h2>{rule.name}</h2>
                    <p>{category}{subcategory ? ` · ${subcategory}` : ""}</p>
                  </div>
                </div>
                <div className="recurring-rule-schedule">
                  <span><strong>{FREQUENCY_LABEL[rule.frequency]}</strong></span>
                  <span>Desde {formatDate(rule.effective_from)}{rule.effective_until ? ` hasta ${formatDate(rule.effective_until)}` : ""}</span>
                </div>
                <strong className={`recurring-rule-amount ${income ? "positive" : "negative"}`}>
                  {formatCurrency(Number(rule.amount))}
                </strong>
                <div className="recurring-rule-actions" role="group" aria-label={`Acciones para ${rule.name}`}>
                  <button className="button small" type="button" onClick={() => setEditing(rule)} disabled={actionId !== null}>
                    <Pencil size={15} />Editar
                  </button>
                  <button className="button small" type="button" onClick={() => void toggle(rule)} disabled={actionId !== null}>
                    {rule.is_active ? <CirclePause size={15} /> : <CirclePlay size={15} />}
                    {rule.is_active ? "Pausar" : "Reanudar"}
                  </button>
                  <button className="button small danger" type="button" onClick={() => void remove(rule)} disabled={actionId !== null}>
                    <Trash2 size={15} />Eliminar
                  </button>
                </div>
                {!rule.is_active ? <span className="recurring-paused-label">En pausa</span> : null}
              </article>
            );
          })}
        </div>
      ) : (
        <div className="card empty-state recurring-empty">
          <Repeat2 size={28} />
          <p>Todavía no hay recurrentes.</p>
          <span>Crea uno para que los apuntes repetidos se añadan solos.</span>
          <button className="button primary" type="button" onClick={() => setEditing("new")}><Plus size={16} />Crear el primero</button>
        </div>
      )}

      {editing ? (
        <AppModal
          className="recurring-modal"
          title={editing === "new" ? "Nuevo recurrente" : "Editar recurrente"}
          eyebrow="Automático"
          onClose={() => setEditing(null)}
        >
          <RecurringForm
            initial={editing === "new" ? undefined : editing}
            onSaved={() => setEditing(null)}
            onCancel={() => setEditing(null)}
          />
        </AppModal>
      ) : null}
    </div>
  );
}
