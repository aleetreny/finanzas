"use client";

import {
  CalendarDays,
  Check,
  ChevronDown,
  ChevronRight,
  LoaderCircle,
  MapPinned,
  Pencil,
  Plus,
  Route,
  Trash2,
} from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import { AppLink } from "@/components/app-link";
import { AppModal } from "@/components/app-modal";
import { useFinance } from "@/components/finance-provider";
import { PageHeader } from "@/components/page-header";
import { TransactionForm } from "@/components/transaction-form";
import { formatCurrency, formatDate, todayIso } from "@/lib/format";
import type { Transaction, TripProject } from "@/lib/types";

type EditingTrip = TripProject | "new" | null;

function inclusiveDays(start: string, end: string) {
  const startTime = new Date(`${start}T00:00:00Z`).getTime();
  const endTime = new Date(`${end}T00:00:00Z`).getTime();
  return Math.max(1, Math.round((endTime - startTime) / 86_400_000) + 1);
}

function TripForm({
  initial,
  onSaved,
  onCancel,
}: {
  initial?: TripProject;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const { saveTripProject } = useFinance();
  const today = todayIso();
  const [name, setName] = useState(initial?.name ?? "");
  const [startDate, setStartDate] = useState(initial?.start_date ?? today);
  const [endDate, setEndDate] = useState(initial?.end_date ?? today);
  const [isActive, setIsActive] = useState(initial?.is_active ?? true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await saveTripProject({
        name,
        start_date: startDate,
        end_date: endDate,
        is_active: isActive,
      }, initial?.id);
      onSaved();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo guardar el viaje.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="trip-form" onSubmit={submit}>
      <div className="field full">
        <label htmlFor="trip-name">Nombre del viaje</label>
        <input
          id="trip-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="p. ej. Eclipse"
          autoComplete="off"
          required
          minLength={2}
        />
      </div>
      <div className="trip-date-grid">
        <div className="field">
          <label htmlFor="trip-start">Desde</label>
          <input id="trip-start" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} required />
        </div>
        <div className="field">
          <label htmlFor="trip-end">Hasta</label>
          <input id="trip-end" type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} required />
        </div>
      </div>
      <label className="trip-active-check">
        <input type="checkbox" checked={isActive} onChange={(event) => setIsActive(event.target.checked)} />
        <span>
          <strong>Disponible al anotar gastos</strong>
          <small>Al cerrarlo seguirá aquí, pero dejará de aparecer en el selector.</small>
        </span>
      </label>
      {error ? <p className="notice error" role="alert">{error}</p> : null}
      <div className="form-actions trip-form-actions">
        <button className="button" type="button" onClick={onCancel} disabled={saving}>Cancelar</button>
        <button className="button primary" type="submit" disabled={saving || name.trim().length < 2}>
          {saving ? <LoaderCircle className="spin" size={17} /> : <Check size={17} />}
          {saving ? "Guardando…" : "Guardar viaje"}
        </button>
      </div>
    </form>
  );
}

export function TripsView() {
  const {
    categories,
    subcategories,
    transactions,
    tripProjects,
    deleteTransaction,
    deleteTripProject,
  } = useFinance();
  const [selectedId, setSelectedId] = useState("");
  const [editing, setEditing] = useState<EditingTrip>(null);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deletingTransactionId, setDeletingTransactionId] = useState<string | null>(null);
  const [transactionError, setTransactionError] = useState<string | null>(null);
  const categoryNames = useMemo(
    () => new Map(categories.map((category) => [category.id, category.name])),
    [categories],
  );
  const subcategoryNames = useMemo(
    () => new Map(subcategories.map((subcategory) => [subcategory.id, subcategory.name])),
    [subcategories],
  );
  const totalsByProject = useMemo(() => {
    const totals = new Map<string, number>();
    for (const transaction of transactions) {
      if (!transaction.trip_project_id || Number(transaction.amount) >= 0) continue;
      totals.set(
        transaction.trip_project_id,
        (totals.get(transaction.trip_project_id) ?? 0) + Math.abs(Number(transaction.amount)),
      );
    }
    return totals;
  }, [transactions]);
  const latestByProject = useMemo(() => {
    const latest = new Map<string, string>();
    for (const transaction of transactions) {
      if (!transaction.trip_project_id) continue;
      const current = latest.get(transaction.trip_project_id) ?? "";
      if (transaction.transaction_date > current) {
        latest.set(transaction.trip_project_id, transaction.transaction_date);
      }
    }
    return latest;
  }, [transactions]);
  const orderedProjects = useMemo(
    () => [...tripProjects].sort((left, right) =>
      Number(right.is_active) - Number(left.is_active)
      || (latestByProject.get(right.id) ?? right.start_date ?? right.created_at)
        .localeCompare(latestByProject.get(left.id) ?? left.start_date ?? left.created_at)),
    [latestByProject, tripProjects],
  );

  const activeSelectedId = orderedProjects.some((project) => project.id === selectedId)
    ? selectedId
    : orderedProjects[0]?.id ?? "";
  const selected = orderedProjects.find((project) => project.id === activeSelectedId) ?? null;
  const selectedTransactions = useMemo(
    () => transactions
      .filter((transaction) => transaction.trip_project_id === activeSelectedId)
      .sort((left, right) =>
        right.transaction_date.localeCompare(left.transaction_date)
        || right.created_at.localeCompare(left.created_at)),
    [activeSelectedId, transactions],
  );
  const expenses = selectedTransactions.filter((transaction) => Number(transaction.amount) < 0);
  const spent = expenses.reduce((sum, transaction) => sum + Math.abs(Number(transaction.amount)), 0);
  const inferredStart = selectedTransactions.at(-1)?.transaction_date ?? null;
  const inferredEnd = selectedTransactions[0]?.transaction_date ?? null;
  const tripStart = selected?.start_date ?? inferredStart;
  const tripEnd = selected?.end_date ?? inferredEnd;
  const tripDays = tripStart && tripEnd ? inclusiveDays(tripStart, tripEnd) : null;
  const categoryBreakdown = useMemo(() => {
    const totals = new Map<string, {
      id: string;
      name: string;
      total: number;
      transactions: Transaction[];
    }>();
    for (const transaction of selectedTransactions) {
      if (Number(transaction.amount) >= 0) continue;
      const id = transaction.category_id ?? "uncategorized";
      const current = totals.get(id) ?? {
        id,
        name: categoryNames.get(transaction.category_id ?? "") ?? "Sin categoría",
        total: 0,
        transactions: [],
      };
      current.total += Math.abs(Number(transaction.amount));
      current.transactions.push(transaction);
      totals.set(id, current);
    }
    return [...totals.values()]
      .sort((left, right) => right.total - left.total);
  }, [categoryNames, selectedTransactions]);

  async function removeSelectedTrip() {
    if (!selected) return;
    const confirmed = window.confirm(
      `¿Borrar “${selected.name}”? Sus apuntes se conservarán, pero quedarán sin viaje.`,
    );
    if (!confirmed) return;
    setDeleteError(null);
    setDeleting(true);
    try {
      await deleteTripProject(selected.id);
      setExpandedCategories({});
    } catch (caught) {
      setDeleteError(caught instanceof Error ? caught.message : "No se pudo borrar el viaje.");
    } finally {
      setDeleting(false);
    }
  }

  function editTransaction(transaction: Transaction) {
    setTransactionError(null);
    setEditingTransaction(transaction);
  }

  async function removeTransaction(transaction: Transaction) {
    if (!window.confirm(`¿Eliminar “${transaction.name}” de forma permanente?`)) return;
    setTransactionError(null);
    setDeletingTransactionId(transaction.id);
    try {
      await deleteTransaction(transaction.id);
      setEditingTransaction((current) => current?.id === transaction.id ? null : current);
    } catch (caught) {
      setTransactionError(caught instanceof Error ? caught.message : "No se pudo eliminar el gasto.");
    } finally {
      setDeletingTransactionId((current) => current === transaction.id ? null : current);
    }
  }

  return (
    <div className="page trips-page">
      <PageHeader
        eyebrow="Maleta financiera"
        title="Viajes"
        description="Agrupa cada gasto en su viaje y descubre de un vistazo cómo te ha salido."
        action={
          <button className="button primary" type="button" onClick={() => setEditing("new")}>
            <Plus size={17} />Nuevo viaje
          </button>
        }
      />

      {orderedProjects.length ? (
        <>
          <div className="trip-project-rail" role="tablist" aria-label="Seleccionar viaje">
            {orderedProjects.map((project) => {
              const projectSpent = totalsByProject.get(project.id) ?? 0;
              const active = project.id === activeSelectedId;
              return (
                <button
                  className={`trip-project-tab${active ? " active" : ""}`}
                  key={project.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => {
                    setSelectedId(project.id);
                    setExpandedCategories({});
                    setDeleteError(null);
                  }}
                >
                  <span className="trip-project-name">
                    <span className={`trip-status-dot${project.is_active ? "" : " closed"}`} />
                    {project.name}
                  </span>
                  <strong>{formatCurrency(projectSpent)}</strong>
                </button>
              );
            })}
          </div>

          {selected ? (
            <section className="trip-notebook" aria-labelledby="selected-trip-title">
              <div className="trip-hero">
                <div>
                  <p className="eyebrow">{selected.is_active ? "Viaje abierto" : "Viaje cerrado"}</p>
                  <h2 id="selected-trip-title">{selected.name}</h2>
                  <p className="trip-dates">
                    <CalendarDays size={16} aria-hidden="true" />
                    {tripStart && tripEnd ? (
                      <>
                        {formatDate(tripStart)} — {formatDate(tripEnd)}
                        <span>· {tripDays} días</span>
                      </>
                    ) : "Fechas por definir"}
                  </p>
                </div>
                <div className="trip-hero-side">
                  <div className="trip-hero-actions">
                    <button className="button small" type="button" onClick={() => setEditing(selected)} disabled={deleting}>
                      <Pencil size={15} />Editar
                    </button>
                    <button className="button small danger" type="button" onClick={() => void removeSelectedTrip()} disabled={deleting}>
                      {deleting ? <LoaderCircle className="spin" size={15} /> : <Trash2 size={15} />}
                      {deleting ? "Borrando…" : "Borrar"}
                    </button>
                  </div>
                  <div className="trip-spent-summary" aria-label={`Resumen de ${selected.name}`}>
                    <span>Total gastado</span>
                    <strong>{formatCurrency(spent)}</strong>
                    <small>{expenses.length} {expenses.length === 1 ? "gasto" : "gastos"}</small>
                  </div>
                </div>
              </div>
              {deleteError ? <p className="notice error" role="alert">{deleteError}</p> : null}

              <section className="trip-breakdown trip-breakdown-wide" aria-labelledby="trip-breakdown-title">
                <div className="trip-section-title">
                  <div>
                    <p className="eyebrow">Dónde se fue</p>
                    <h3 id="trip-breakdown-title">Desglose por categorías</h3>
                  </div>
                  <Route size={22} aria-hidden="true" />
                </div>
                <p className="trip-breakdown-hint">Abre una categoría para ver cada concepto incluido. Pulsa un gasto para editarlo o borrarlo.</p>
                {categoryBreakdown.length ? (
                  <div className="trip-category-list">
                    {categoryBreakdown.map((row) => {
                      const percentage = spent ? row.total / spent * 100 : 0;
                      const isExpanded = Boolean(expandedCategories[row.id]);
                      return (
                        <article className={`trip-category-group${isExpanded ? " expanded" : ""}`} key={row.id}>
                          <button
                            className="trip-category-toggle"
                            type="button"
                            aria-expanded={isExpanded}
                            onClick={() => setExpandedCategories((current) => ({
                              ...current,
                              [row.id]: !current[row.id],
                            }))}
                          >
                            <span className="trip-category-chevron" aria-hidden="true">
                              {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                            </span>
                            <span className="trip-category-main">
                              <span className="trip-category-label">
                                <strong>{row.name}</strong>
                                <span>{percentage.toLocaleString("es-ES", { maximumFractionDigits: 0 })}% · {row.transactions.length} {row.transactions.length === 1 ? "gasto" : "gastos"}</span>
                              </span>
                              <span className="trip-category-line" aria-hidden="true">
                                <span style={{ width: `${Math.max(3, percentage)}%` }} />
                              </span>
                            </span>
                            <strong className="amount">{formatCurrency(row.total)}</strong>
                          </button>
                          {isExpanded ? (
                            <div className="trip-category-expenses">
                              {row.transactions.map((transaction) => (
                                <button
                                  className="trip-transaction"
                                  key={transaction.id}
                                  type="button"
                                  aria-label={`Editar gasto ${transaction.name}`}
                                  onClick={() => editTransaction(transaction)}
                                >
                                  <div>
                                    <strong>{transaction.name}</strong>
                                    <span>
                                      {formatDate(transaction.transaction_date)}
                                      {transaction.subcategory_id
                                        ? ` · ${subcategoryNames.get(transaction.subcategory_id) ?? "Sin subcategoría"}`
                                        : ""}
                                    </span>
                                  </div>
                                  <strong className="amount">{formatCurrency(Math.abs(Number(transaction.amount)))}</strong>
                                </button>
                              ))}
                            </div>
                          ) : null}
                        </article>
                      );
                    })}
                  </div>
                ) : (
                  <p className="empty-inline">Todavía no hay gastos en este viaje.</p>
                )}
              </section>

              <div className="trip-add-expense">
                <div>
                  <strong>¿Tienes otro ticket?</strong>
                  <span>Al anotarlo, elige “{selected.name}” en el selector de viaje.</span>
                </div>
                <AppLink href="/movimientos/nuevo" className="button primary"><Plus size={16} />Anotar gasto</AppLink>
              </div>
            </section>
          ) : null}
        </>
      ) : (
        <div className="card empty-state trip-empty">
          <MapPinned size={32} aria-hidden="true" />
          <p>Todavía no tienes ningún viaje.</p>
          <span>Crea el primero y podrás seleccionarlo al anotar cada gasto.</span>
          <button className="button primary" type="button" onClick={() => setEditing("new")}>
            <Plus size={16} />Crear mi primer viaje
          </button>
        </div>
      )}

      {editing ? (
        <AppModal
          title={editing === "new" ? "Nuevo viaje" : `Editar ${editing.name}`}
          eyebrow="Organiza la ruta"
          onClose={() => setEditing(null)}
        >
          <TripForm
            initial={editing === "new" ? undefined : editing}
            onSaved={() => setEditing(null)}
            onCancel={() => setEditing(null)}
          />
        </AppModal>
      ) : null}

      {editingTransaction ? (
        <AppModal title="Editar gasto" eyebrow="Gasto del viaje" onClose={() => setEditingTransaction(null)}>
          {transactionError ? <p className="notice error" role="alert" style={{ marginBottom: 16 }}>{transactionError}</p> : null}
          <TransactionForm
            initial={editingTransaction}
            scope="general"
            onSaved={() => setEditingTransaction(null)}
            onCancel={() => setEditingTransaction(null)}
            onDelete={() => removeTransaction(editingTransaction)}
            isDeleting={deletingTransactionId === editingTransaction.id}
          />
        </AppModal>
      ) : null}
    </div>
  );
}
