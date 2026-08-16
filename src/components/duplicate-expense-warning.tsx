"use client";

import { Check, LoaderCircle, TriangleAlert, Undo2 } from "lucide-react";
import { useMemo } from "react";
import { AppModal } from "@/components/app-modal";
import { useFinance } from "@/components/finance-provider";
import { DUPLICATE_LOOKBACK } from "@/lib/duplicate-transactions";
import { formatCurrency, formatDate } from "@/lib/format";
import type { Transaction } from "@/lib/types";

export type PendingExpense = {
  name: string;
  amount: number;
  transaction_date: string;
  category_id: string;
  subcategory_id: string | null;
};

export function DuplicateExpenseWarning({
  existing,
  pending,
  saving = false,
  onConfirm,
  onCancel,
}: {
  existing: Transaction;
  pending: PendingExpense;
  saving?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const { categories, subcategories } = useFinance();
  const categoryNames = useMemo(() => new Map(categories.map((item) => [item.id, item.name])), [categories]);
  const subcategoryNames = useMemo(() => new Map(subcategories.map((item) => [item.id, item.name])), [subcategories]);

  function categoryLabel(categoryId: string | null, subcategoryId: string | null) {
    return [
      categoryNames.get(categoryId ?? "") ?? "Sin categoría",
      subcategoryId ? subcategoryNames.get(subcategoryId) : null,
    ].filter(Boolean).join(" · ");
  }

  return (
    <AppModal
      className="duplicate-modal"
      eyebrow="Puede que ya lo tengas"
      title="¿Seguro que quieres anotarlo?"
      onClose={onCancel}
    >
      <div className="duplicate-warning">
        <p className="duplicate-lead">
          <TriangleAlert size={19} aria-hidden="true" />
          <span>
            Coincide en importe y categoría con <strong>«{existing.name}»</strong>, uno de tus últimos{" "}
            {DUPLICATE_LOOKBACK} gastos.
          </span>
        </p>

        <div className="duplicate-compare">
          <article className="duplicate-entry existing">
            <p className="duplicate-entry-role">Ya lo tienes anotado</p>
            <p className="duplicate-entry-head">
              <strong>{existing.name}</strong>
              <span className="amount">{formatCurrency(-Math.abs(existing.amount))}</span>
            </p>
            <p className="duplicate-entry-meta">{formatDate(existing.transaction_date)}</p>
            <p className="duplicate-entry-meta">{categoryLabel(existing.category_id, existing.subcategory_id)}</p>
            {existing.notes ? <p className="duplicate-entry-note">{existing.notes}</p> : null}
          </article>

          <article className="duplicate-entry pending">
            <p className="duplicate-entry-role">Lo que vas a anotar</p>
            <p className="duplicate-entry-head">
              <strong>{pending.name}</strong>
              <span className="amount">{formatCurrency(-Math.abs(pending.amount))}</span>
            </p>
            <p className="duplicate-entry-meta">{formatDate(pending.transaction_date)}</p>
            <p className="duplicate-entry-meta">{categoryLabel(pending.category_id, pending.subcategory_id)}</p>
          </article>
        </div>

        <div className="duplicate-actions">
          <button className="button" type="button" onClick={onCancel} disabled={saving}>
            <Undo2 size={16} />No, lo reviso
          </button>
          <button className="button primary" type="button" onClick={onConfirm} disabled={saving}>
            {saving ? <LoaderCircle className="spin" size={17} /> : <Check size={17} />}
            {saving ? "Anotando…" : "Sí, anotarlo igualmente"}
          </button>
        </div>
      </div>
    </AppModal>
  );
}
