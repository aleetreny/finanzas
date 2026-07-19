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
  scope = "general",
}: {
  initial?: Transaction;
  onSaved?: () => void;
  onCancel?: () => void;
  scope?: "general" | "property";
}) {
  const router = useRouter();
  const { categories, subcategories, addTransaction, updateTransaction } = useFinance();
  const [advanced, setAdvanced] = useState(Boolean(initial?.context || initial?.notes));
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [selectionError, setSelectionError] = useState<string | null>(null);

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

  const activeCategories = useMemo(
    () => categories.filter((category) => category.is_active || category.id === initial?.category_id),
    [categories, initial?.category_id],
  );
  const availableCategories = useMemo(
    () => activeCategories.filter((category) => {
      if (scope === "property") return category.category_scope === "property";
      return category.category_scope === (direction === "income" ? "income" : "expense");
    }),
    [activeCategories, direction, scope],
  );
  const availableSubcategories = useMemo(
    () => subcategories.filter((subcategory) => subcategory.category_id === categoryId && subcategory.is_active),
    [categoryId, subcategories],
  );
  const usesSubcategorySelector = scope === "property" || direction === "income";

  const today = todayIso();
  const yesterday = shiftDay(-1);

  // Cada tipo de apunte solo puede usar sus categorías: gastos generales,
  // ingresos o Piso Málaga. Si solo hay una, se selecciona automáticamente.
  useEffect(() => {
    if (!availableCategories.length) return;
    if (availableCategories.some((category) => category.id === categoryId)) return;
    setValue("category_id", availableCategories.length === 1 ? availableCategories[0].id : "", { shouldValidate: true });
    setValue("subcategory_id", "");
  }, [availableCategories, categoryId, setValue]);

  function pickCategory(id: string) {
    setValue("category_id", id, { shouldValidate: true });
    setValue("subcategory_id", "");
    setSelectionError(null);
  }

  async function submit(values: FormValues) {
    setSubmitError(null);
    if (usesSubcategorySelector && availableSubcategories.length && !values.subcategory_id) {
      setSelectionError(direction === "income" && scope === "general" ? "Elige el tipo de ingreso." : "Elige el tipo de apunte.");
      return;
    }
    setSelectionError(null);

    const input: TransactionInput = {
      transaction_date: values.transaction_date,
      name: values.name.trim(),
      amount: values.direction === "expense" ? -Math.abs(values.amount) : Math.abs(values.amount),
      direction: values.direction,
      category_id: values.category_id,
      subcategory_id: values.subcategory_id || null,
      context: scope === "property" ? "Piso Málaga" : values.context || null,
      platform: null,
      fiscal_property_status: null,
      notes: values.notes || null,
    };

    try {
      if (initial) await updateTransaction(initial.id, input);
      else await addTransaction(input);
      if (onSaved) onSaved();
      else router.push(scope === "property" ? "/piso-malaga" : "/movimientos");
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

      {!availableCategories.length ? (
        <p className="notice error" style={{ marginTop: 20 }}>
          {scope === "property"
            ? "No hay una categoría configurada para el Piso Málaga. Créala en Ajustes."
            : direction === "income"
              ? "No hay una categoría configurada para ingresos. Créala en Ajustes."
              : "No hay categorías de gasto activas. Créala o actívala en Ajustes."}
        </p>
      ) : usesSubcategorySelector ? (
        <>
          {availableCategories.length > 1 ? (
            <div className="field" style={{ marginTop: 20 }}>
              <label htmlFor="tx-category">{scope === "property" ? "Categoría del piso" : "Categoría de ingreso"}</label>
              <select id="tx-category" value={categoryId} onChange={(event) => pickCategory(event.target.value)}>
                <option value="">Selecciona una categoría…</option>
                {availableCategories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
              </select>
            </div>
          ) : null}
          <div className="field" style={{ marginTop: 20 }}>
            <label htmlFor="tx-subcategory">{scope === "property" ? "Tipo de apunte del piso" : "Tipo de ingreso"}</label>
            <select
              id="tx-subcategory"
              value={subcategoryId}
              onChange={(event) => {
                setValue("subcategory_id", event.target.value);
                setSelectionError(null);
              }}
              disabled={!categoryId || !availableSubcategories.length}
            >
              <option value="">{availableSubcategories.length ? "Selecciona una opción…" : "Sin subcategorías configuradas"}</option>
              {availableSubcategories.map((subcategory) => <option key={subcategory.id} value={subcategory.id}>{subcategory.name}</option>)}
            </select>
            {selectionError ? <p className="field-error">{selectionError}</p> : null}
          </div>
        </>
      ) : (
        <>
          <div className="q-label">
            Categoría
            {errors.category_id ? <span className="opt" style={{ color: "var(--red-pen)" }}>{errors.category_id.message}</span> : null}
          </div>
          <div className="chip-grid">
            {availableCategories.map((category) => (
              <button type="button" key={category.id} className={`chip ${categoryId === category.id ? "active" : ""}`} onClick={() => pickCategory(category.id)}>
                {category.name}
              </button>
            ))}
          </div>

          {availableSubcategories.length ? (
            <>
              <div className="q-label">Subcategoría <span className="opt">opcional</span></div>
              <div className="chip-grid">
                {availableSubcategories.map((subcategory) => (
                  <button type="button" key={subcategory.id} className={`chip sub ${subcategoryId === subcategory.id ? "active" : ""}`} onClick={() => setValue("subcategory_id", subcategoryId === subcategory.id ? "" : subcategory.id)}>
                    {subcategory.name}
                  </button>
                ))}
              </div>
            </>
          ) : null}
        </>
      )}

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

      <button type="button" className="more-toggle" onClick={() => setAdvanced((value) => !value)} style={{ marginTop: 18 }}>
        Más detalles <ChevronDown size={15} style={{ transform: advanced ? "rotate(180deg)" : undefined, transition: "transform .15s ease" }} />
      </button>
      {advanced ? (
        <div style={{ display: "grid", gap: 16, marginTop: 14 }}>
          {scope === "general" ? (
            <div className="field">
              <label htmlFor="tx-context">Contexto</label>
              <input id="tx-context" placeholder="Personal, viaje…" {...register("context")} />
            </div>
          ) : null}
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
        <button className="button primary" type="submit" disabled={isSubmitting || !availableCategories.length}>
          {isSubmitting ? <LoaderCircle className="spin" size={18} /> : <Check size={18} />}
          {initial ? "Guardar cambios" : "Anotar"}
        </button>
      </div>
    </form>
  );
}
