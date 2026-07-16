"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Check, ChevronDown, LoaderCircle, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { useFinance } from "@/components/finance-provider";
import { todayIso } from "@/lib/format";
import type { Transaction, TransactionInput } from "@/lib/types";

const formSchema = z.object({
  transaction_date: z.string().min(10, "Indica una fecha."),
  name: z.string().trim().min(2, "Ponle un nombre."),
  amount: z.number().positive("El importe debe ser mayor que cero."),
  direction: z.enum(["income", "expense"]),
  category_id: z.string().min(1, "Elige una categoría."),
  subcategory_id: z.string().optional(),
  context: z.string().optional(),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

function defaults(initial?: Transaction): FormValues {
  return {
    transaction_date: initial?.transaction_date ?? todayIso(),
    name: initial?.name ?? "",
    amount: initial ? Math.abs(initial.amount) : (undefined as unknown as number),
    direction: initial?.direction === "income" ? "income" : "expense",
    category_id: initial?.category_id ?? "",
    subcategory_id: initial?.subcategory_id ?? "",
    context: initial?.context ?? "",
    notes: initial?.notes ?? "",
  };
}

function shiftDay(days: number): string {
  const date = new Date();
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function TransactionForm({
  initial,
  onSaved,
  onCancel,
}: {
  initial?: Transaction;
  onSaved?: () => void;
  onCancel?: () => void;
}) {
  const router = useRouter();
  const { categories, subcategories, addTransaction, updateTransaction } = useFinance();
  const [advanced, setAdvanced] = useState(Boolean(initial?.context || initial?.notes));
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    control,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(formSchema), defaultValues: defaults(initial) });

  const direction = useWatch({ control, name: "direction" });
  const categoryId = useWatch({ control, name: "category_id" });
  const subcategoryId = useWatch({ control, name: "subcategory_id" });
  const transactionDate = useWatch({ control, name: "transaction_date" });

  const activeCategories = useMemo(() => categories.filter((c) => c.is_active), [categories]);
  const availableSubcategories = useMemo(
    () => subcategories.filter((s) => s.category_id === categoryId && s.is_active),
    [categoryId, subcategories],
  );

  const today = todayIso();
  const yesterday = shiftDay(-1);

  // Al pasar a "Ingreso" sin categoría elegida, marca "Ingresos" directamente
  // (un toque menos en el caso típico); al volver a "Gasto" se desmarca para
  // no guardar un gasto en esa categoría sin querer.
  useEffect(() => {
    const ingresos = activeCategories.find((c) => /^ingres/i.test(c.name));
    if (!ingresos) return;
    if (direction === "income" && !categoryId) {
      setValue("category_id", ingresos.id, { shouldValidate: true });
      setValue("subcategory_id", "");
    } else if (direction === "expense" && categoryId === ingresos.id) {
      setValue("category_id", "");
      setValue("subcategory_id", "");
    }
  }, [direction, categoryId, activeCategories, setValue]);

  function pickCategory(id: string) {
    setValue("category_id", id, { shouldValidate: true });
    setValue("subcategory_id", "");
  }

  async function submit(values: FormValues) {
    setSubmitError(null);
    const input: TransactionInput = {
      transaction_date: values.transaction_date,
      name: values.name.trim(),
      amount: values.direction === "expense" ? -Math.abs(values.amount) : Math.abs(values.amount),
      direction: values.direction,
      category_id: values.category_id,
      subcategory_id: values.subcategory_id || null,
      context: values.context || null,
      platform: null,
      fiscal_property_status: null,
      notes: values.notes || null,
    };

    try {
      if (initial) await updateTransaction(initial.id, input);
      else await addTransaction(input);
      if (onSaved) onSaved();
      else router.push("/movimientos");
    } catch (caught) {
      setSubmitError(caught instanceof Error ? caught.message : "No se pudo guardar el movimiento.");
    }
  }

  return (
    <form className="quick-form" onSubmit={handleSubmit(submit)}>
      <div className="seg" role="group" aria-label="Tipo de movimiento">
        <button type="button" className={`expense ${direction === "expense" ? "active" : ""}`} onClick={() => setValue("direction", "expense")}>Gasto</button>
        <button type="button" className={`income ${direction === "income" ? "active" : ""}`} onClick={() => setValue("direction", "income")}>Ingreso</button>
      </div>

      <div className="amount-hero">
        <span className="cur">euros</span>
        <input
          type="number"
          inputMode="decimal"
          step="0.01"
          min="0.01"
          placeholder="0"
          aria-label="Importe en euros"
          autoFocus={!initial}
          {...register("amount", { valueAsNumber: true })}
        />
        <span className="hint">{errors.amount ? errors.amount.message : direction === "expense" ? "¿cuánto te has gastado?" : "¿cuánto has ingresado?"}</span>
      </div>

      <div className="q-label">
        Categoría
        {errors.category_id ? <span className="opt" style={{ color: "var(--red-pen)" }}>{errors.category_id.message}</span> : null}
      </div>
      <div className="chip-grid">
        {activeCategories.map((c) => (
          <button type="button" key={c.id} className={`chip ${categoryId === c.id ? "active" : ""}`} onClick={() => pickCategory(c.id)}>
            {c.name}
          </button>
        ))}
      </div>

      {availableSubcategories.length ? (
        <>
          <div className="q-label">Subcategoría <span className="opt">opcional</span></div>
          <div className="chip-grid">
            {availableSubcategories.map((s) => (
              <button type="button" key={s.id} className={`chip sub ${subcategoryId === s.id ? "active" : ""}`} onClick={() => setValue("subcategory_id", subcategoryId === s.id ? "" : s.id)}>
                {s.name}
              </button>
            ))}
          </div>
        </>
      ) : null}

      <div className="q-label">Concepto</div>
      <div className="field full">
        <input type="text" placeholder={direction === "expense" ? "p. ej. compra del super" : "p. ej. nómina"} {...register("name")} />
        {errors.name ? <p className="field-error">{errors.name.message}</p> : null}
      </div>

      <div className="q-label">Fecha</div>
      <div className="q-date">
        <button type="button" className={`date-chip ${transactionDate === today ? "active" : ""}`} onClick={() => setValue("transaction_date", today)}>Hoy</button>
        <button type="button" className={`date-chip ${transactionDate === yesterday ? "active" : ""}`} onClick={() => setValue("transaction_date", yesterday)}>Ayer</button>
        <input type="date" aria-label="Otra fecha" {...register("transaction_date")} />
      </div>
      {errors.transaction_date ? <p className="field-error" style={{ marginTop: 6 }}>{errors.transaction_date.message}</p> : null}

      <button type="button" className="more-toggle" onClick={() => setAdvanced((v) => !v)} style={{ marginTop: 18 }}>
        Más detalles <ChevronDown size={15} style={{ transform: advanced ? "rotate(180deg)" : undefined, transition: "transform .15s ease" }} />
      </button>
      {advanced ? (
        <div style={{ display: "grid", gap: 16, marginTop: 14 }}>
          <div className="field">
            <label htmlFor="tx-context">Contexto</label>
            <input id="tx-context" placeholder="Personal, viaje…" {...register("context")} />
          </div>
          <div className="field">
            <label htmlFor="tx-notes">Notas</label>
            <textarea id="tx-notes" placeholder="Lo que quieras recordar" {...register("notes")} />
          </div>
        </div>
      ) : null}

      {submitError ? <p className="notice error" style={{ marginTop: 16 }}>{submitError}</p> : null}

      <div className="q-save">
        {onCancel ? (
          <button className="button" type="button" onClick={onCancel} style={{ width: "100%", marginBottom: 8 }}><X size={16} />Cancelar</button>
        ) : null}
        <button className="button primary" type="submit" disabled={isSubmitting}>
          {isSubmitting ? <LoaderCircle className="spin" size={18} /> : <Check size={18} />}
          {initial ? "Guardar cambios" : "Anotar"}
        </button>
      </div>
    </form>
  );
}
