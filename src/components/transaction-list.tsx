"use client";

import { LoaderCircle, Pencil, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { AppModal } from "@/components/app-modal";
import { useFinance } from "@/components/finance-provider";
import { TransactionForm } from "@/components/transaction-form";
import { formatCurrency, formatDate } from "@/lib/format";
import type { Transaction } from "@/lib/types";

export function TransactionList({
  transactions,
  formScope = "general",
}: {
  transactions: Transaction[];
  formScope?: "general" | "property";
}) {
  const { categories, subcategories, deleteTransaction } = useFinance();
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const categoryById = useMemo(() => new Map(categories.map((item) => [item.id, item.name])), [categories]);
  const subcategoryById = useMemo(() => new Map(subcategories.map((item) => [item.id, item.name])), [subcategories]);
  const visible = transactions.slice(0, 250);

  function edit(transaction: Transaction) {
    setDeleteError(null);
    setEditing(transaction);
  }

  async function remove(transaction: Transaction) {
    if (!window.confirm(`¿Eliminar “${transaction.name}” de forma permanente?`)) return;
    setDeleteError(null);
    setDeletingId(transaction.id);
    try {
      await deleteTransaction(transaction.id);
      setEditing((current) => current?.id === transaction.id ? null : current);
    } catch (caught) {
      setDeleteError(caught instanceof Error ? caught.message : "No se pudo eliminar.");
    } finally {
      setDeletingId((current) => current === transaction.id ? null : current);
    }
  }

  if (!transactions.length) {
    return <div className="card empty-state"><p>No hay movimientos que coincidan con los filtros.</p></div>;
  }

  return (
    <>
      {deleteError ? <p className="notice error">{deleteError}</p> : null}
      <div className="card data-card">
        <table className="data-table">
          <thead><tr><th>Fecha</th><th>Apunte</th><th>Categoría</th><th style={{ textAlign: "right" }}>Importe</th><th aria-label="Acciones" /></tr></thead>
          <tbody>
            {visible.map((row) => (
              <tr key={row.id}>
                <td>{formatDate(row.transaction_date)}</td>
                <td><span className="transaction-name">{row.name}</span>{row.notes || row.context ? <span className="transaction-note">{row.notes ?? row.context}</span> : null}</td>
                <td><span className="badge">{categoryById.get(row.category_id ?? "") ?? "Sin categoría"}</span>{row.subcategory_id ? <span className="transaction-note">{subcategoryById.get(row.subcategory_id)}</span> : null}</td>
                <td className={`amount ${row.amount >= 0 ? "positive" : ""}`}>{formatCurrency(row.amount)}</td>
                <td>
                  <div className="row-actions" role="group" aria-label={`Acciones para ${row.name}`}>
                    <button className="icon-button" type="button" title="Editar" aria-label={`Editar ${row.name}`} disabled={deletingId !== null} onClick={() => edit(row)}><Pencil size={15} /></button>
                    <button className="icon-button danger-icon" type="button" title="Eliminar" aria-label={`Eliminar ${row.name}`} disabled={deletingId !== null} onClick={() => void remove(row)}>
                      {deletingId === row.id ? <LoaderCircle className="spin" size={15} /> : <Trash2 size={15} />}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mobile-list">
          {visible.map((row) => (
            <article className="mobile-transaction" key={row.id}>
              <div className="mobile-transaction-details">
                <strong>{row.name}</strong>
                <span className={`amount ${row.amount >= 0 ? "positive" : ""}`}>{formatCurrency(row.amount)}</span>
                <span className="meta">{formatDate(row.transaction_date)} · {categoryById.get(row.category_id ?? "") ?? "Sin categoría"}</span>
              </div>
              <div className="mobile-transaction-actions" role="group" aria-label={`Acciones para ${row.name}`}>
                <button type="button" className="mobile-transaction-action" disabled={deletingId !== null} onClick={() => edit(row)}><Pencil size={16} /><span>Editar</span></button>
                <button type="button" className="mobile-transaction-action danger" disabled={deletingId !== null} onClick={() => void remove(row)}>
                  {deletingId === row.id ? <LoaderCircle className="spin" size={16} /> : <Trash2 size={16} />}
                  <span>{deletingId === row.id ? "Eliminando…" : "Eliminar"}</span>
                </button>
              </div>
            </article>
          ))}
        </div>
        {transactions.length > visible.length ? <p className="table-note">Se muestran los 250 apuntes más recientes; con los filtros encuentras el resto.</p> : null}
      </div>

      {editing ? (
        <AppModal title="Editar movimiento" eyebrow="Edición" onClose={() => setEditing(null)}>
          {deleteError ? <p className="notice error" style={{ marginBottom: 16 }}>{deleteError}</p> : null}
          <TransactionForm
            initial={editing}
            scope={formScope}
            onSaved={() => setEditing(null)}
            onCancel={() => setEditing(null)}
            onDelete={() => remove(editing)}
            isDeleting={deletingId === editing.id}
          />
        </AppModal>
      ) : null}
    </>
  );
}
