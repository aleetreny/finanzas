"use client";

import {
  CalendarDays,
  Check,
  LoaderCircle,
  MapPinned,
  Pencil,
  Plus,
  ReceiptText,
  Route,
  WalletCards,
} from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import { AppLink } from "@/components/app-link";
import { AppModal } from "@/components/app-modal";
import { useFinance } from "@/components/finance-provider";
import { PageHeader } from "@/components/page-header";
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
  const { categories, transactions, tripProjects } = useFinance();
  const [selectedId, setSelectedId] = useState("");
  const [editing, setEditing] = useState<EditingTrip>(null);
  const categoryNames = useMemo(
    () => new Map(categories.map((category) => [category.id, category.name])),
    [categories],
  );
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
  const income = selectedTransactions.filter((transaction) => Number(transaction.amount) > 0);
  const spent = expenses.reduce((sum, transaction) => sum + Math.abs(Number(transaction.amount)), 0);
  const recovered = income.reduce((sum, transaction) => sum + Number(transaction.amount), 0);
  const netCost = spent - recovered;
  const inferredStart = selectedTransactions.at(-1)?.transaction_date ?? null;
  const inferredEnd = selectedTransactions[0]?.transaction_date ?? null;
  const tripStart = selected?.start_date ?? inferredStart;
  const tripEnd = selected?.end_date ?? inferredEnd;
  const tripDays = tripStart && tripEnd ? inclusiveDays(tripStart, tripEnd) : null;
  const categoryBreakdown = useMemo(() => {
    const totals = new Map<string, number>();
    for (const transaction of selectedTransactions) {
      if (Number(transaction.amount) >= 0) continue;
      const label = categoryNames.get(transaction.category_id ?? "") ?? "Sin categoría";
      totals.set(label, (totals.get(label) ?? 0) + Math.abs(Number(transaction.amount)));
    }
    return [...totals.entries()]
      .map(([name, total]) => ({ name, total }))
      .sort((left, right) => right.total - left.total);
  }, [categoryNames, selectedTransactions]);

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
              const projectSpent = transactions
                .filter((transaction) => transaction.trip_project_id === project.id && Number(transaction.amount) < 0)
                .reduce((sum, transaction) => sum + Math.abs(Number(transaction.amount)), 0);
              const active = project.id === activeSelectedId;
              return (
                <button
                  className={`trip-project-tab${active ? " active" : ""}`}
                  key={project.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setSelectedId(project.id)}
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
                <button className="button small" type="button" onClick={() => setEditing(selected)}>
                  <Pencil size={15} />Editar
                </button>
              </div>

              <div className="trip-summary" aria-label={`Resumen de ${selected.name}`}>
                <div>
                  <span>Gastado</span>
                  <strong>{formatCurrency(spent)}</strong>
                  <small>{expenses.length} {expenses.length === 1 ? "gasto" : "gastos"}</small>
                </div>
                <div>
                  <span>Recuperado</span>
                  <strong className="positive">{formatCurrency(recovered)}</strong>
                  <small>devoluciones o ingresos</small>
                </div>
                <div className="trip-net">
                  <span>Coste neto</span>
                  <strong className={netCost < 0 ? "positive" : ""}>{formatCurrency(netCost)}</strong>
                  <small>{tripDays ? `${formatCurrency(netCost / tripDays)} al día` : "Añade fechas para ver el coste diario"}</small>
                </div>
              </div>

              <div className="trip-detail-grid">
                <section className="trip-breakdown" aria-labelledby="trip-breakdown-title">
                  <div className="trip-section-title">
                    <div>
                      <p className="eyebrow">Dónde se fue</p>
                      <h3 id="trip-breakdown-title">Desglose</h3>
                    </div>
                    <Route size={22} aria-hidden="true" />
                  </div>
                  {categoryBreakdown.length ? (
                    <div className="trip-category-list">
                      {categoryBreakdown.map((row) => {
                        const percentage = spent ? row.total / spent * 100 : 0;
                        return (
                          <div className="trip-category-row" key={row.name}>
                            <div><strong>{row.name}</strong><span>{percentage.toLocaleString("es-ES", { maximumFractionDigits: 0 })}%</span></div>
                            <span className="trip-category-line" aria-hidden="true">
                              <span style={{ width: `${Math.max(3, percentage)}%` }} />
                            </span>
                            <strong className="amount">{formatCurrency(row.total)}</strong>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="empty-inline">Todavía no hay gastos en este viaje.</p>
                  )}
                </section>

                <section className="trip-ledger" aria-labelledby="trip-ledger-title">
                  <div className="trip-section-title">
                    <div>
                      <p className="eyebrow">Ticket a ticket</p>
                      <h3 id="trip-ledger-title">Apuntes</h3>
                    </div>
                    <ReceiptText size={22} aria-hidden="true" />
                  </div>
                  {selectedTransactions.length ? (
                    <div className="trip-transaction-list">
                      {selectedTransactions.map((transaction: Transaction) => (
                        <article className="trip-transaction" key={transaction.id}>
                          <div>
                            <strong>{transaction.name}</strong>
                            <span>{formatDate(transaction.transaction_date)} · {categoryNames.get(transaction.category_id ?? "") ?? "Sin categoría"}</span>
                          </div>
                          <strong className={`amount${Number(transaction.amount) > 0 ? " positive" : ""}`}>
                            {formatCurrency(Number(transaction.amount))}
                          </strong>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <div className="trip-ledger-empty">
                      <WalletCards size={24} aria-hidden="true" />
                      <p>Aún no has asignado ningún gasto a {selected.name}.</p>
                    </div>
                  )}
                </section>
              </div>

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
    </div>
  );
}
