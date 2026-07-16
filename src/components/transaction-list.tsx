"use client";

import { Pencil, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { useFinance } from "@/components/finance-provider";
import { TransactionForm } from "@/components/transaction-form";
import { formatCurrency, formatDate } from "@/lib/format";
import type { Transaction } from "@/lib/types";

export function TransactionList({ transactions }: { transactions: Transaction[] }) {
  const { categories, subcategories, deleteTransaction } = useFinance();
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const categoryById = useMemo(() => new Map(categories.map((item) => [item.id, item.name])), [categories]);
  const subcategoryById = useMemo(() => new Map(subcategories.map((item) => [item.id, item.name])), [subcategories]);
  const visible = transactions.slice(0, 250);

  async function remove(transaction: Transaction) {
    if (!window.confirm(`¿Eliminar “${transaction.name}” de forma permanente?`)) return;
    setDeleteError(null);
    try {
      await deleteTransaction(transaction.id);
    } catch (caught) {
      setDeleteError(caught instanceof Error ? caught.message : "No se pudo eliminar.");
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
                <td><div className="row-actions"><button className="icon-button" title="Editar" onClick={() => setEditing(row)}><Pencil size={15} /></button><button className="icon-button" title="Eliminar" onClick={() => void remove(row)}><Trash2 size={15} /></button></div></td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mobile-list">
          {visible.map((row) => (
            <button type="button" className="mobile-transaction" key={row.id} onClick={() => setEditing(row)}>
              <strong>{row.name}</strong>
              <span className={`amount ${row.amount >= 0 ? "positive" : ""}`}>{formatCurrency(row.amount)}</span>
              <span className="meta">{formatDate(row.transaction_date)} · {categoryById.get(row.category_id ?? "") ?? "Sin categoría"}</span>
            </button>
          ))}
        </div>
        {transactions.length > visible.length ? <p className="table-note">Se muestran los 250 apuntes más recientes; con los filtros encuentras el resto.</p> : null}
      </div>

      {editing ? (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setEditing(null); }}>
          <section className="modal-card" role="dialog" aria-modal="true" aria-label="Editar movimiento">
            <div className="card-header"><div><p className="eyebrow">Edición</p><h2>Modificar movimiento</h2></div></div>
            <div className="card-body"><TransactionForm initial={editing} onSaved={() => setEditing(null)} onCancel={() => setEditing(null)} /></div>
          </section>
        </div>
      ) : null}
    </>
  );
}
