"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ChevronDown, LoaderCircle, Save, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { useFinance } from "@/components/finance-provider";
import { todayIso } from "@/lib/format";
import type { Transaction, TransactionInput } from "@/lib/types";

const formSchema = z.object({
  transaction_date: z.string().min(10, "Indica una fecha."),
  name: z.string().trim().min(2, "Escribe un nombre."),
  amount: z.number().positive("El importe debe ser mayor que cero."),
  direction: z.enum(["income", "expense"]),
  category_id: z.string().min(1, "Selecciona una categoría."),
  subcategory_id: z.string().optional(),
  context: z.string().optional(),
  platform: z.string().optional(),
  fiscal_property_status: z.string().optional(),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

function defaults(initial?: Transaction): FormValues {
  return {
    transaction_date: initial?.transaction_date ?? todayIso(),
    name: initial?.name ?? "",
    amount: Math.abs(initial?.amount ?? 0),
    direction: initial?.direction === "income" ? "income" : "expense",
    category_id: initial?.category_id ?? "",
    subcategory_id: initial?.subcategory_id ?? "",
    context: initial?.context ?? "",
    platform: initial?.platform ?? "",
    fiscal_property_status: initial?.fiscal_property_status ?? "",
    notes: initial?.notes ?? "",
  };
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
  const [advanced, setAdvanced] = useState(Boolean(initial?.context || initial?.notes || initial?.platform));
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
  const availableSubcategories = useMemo(
    () => subcategories.filter((item) => item.category_id === categoryId && item.is_active),
    [categoryId, subcategories],
  );

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
      platform: values.platform || null,
      fiscal_property_status: values.fiscal_property_status || null,
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
    <form onSubmit={handleSubmit(submit)}>
      <div className="form-grid">
        <div className="field full">
          <label>Tipo de movimiento</label>
          <div className="direction-toggle">
            <button type="button" className={direction === "expense" ? "active" : ""} onClick={() => setValue("direction", "expense")}>Gasto</button>
            <button type="button" className={direction === "income" ? "active" : ""} onClick={() => setValue("direction", "income")}>Ingreso</button>
          </div>
        </div>
        <div className="field">
          <label htmlFor="transaction-date">Fecha</label>
          <input id="transaction-date" type="date" {...register("transaction_date")} />
          {errors.transaction_date ? <p className="field-error">{errors.transaction_date.message}</p> : null}
        </div>
        <div className="field">
          <label htmlFor="transaction-amount">Importe (€)</label>
          <input id="transaction-amount" type="number" inputMode="decimal" step="0.01" min="0.01" placeholder="0,00" {...register("amount", { valueAsNumber: true })} />
          {errors.amount ? <p className="field-error">{errors.amount.message}</p> : null}
        </div>
        <div className="field full">
          <label htmlFor="transaction-name">Nombre</label>
          <input id="transaction-name" type="text" placeholder="¿En qué se ha movido el dinero?" autoFocus={!initial} {...register("name")} />
          {errors.name ? <p className="field-error">{errors.name.message}</p> : null}
        </div>
        <div className="field">
          <label htmlFor="transaction-category">Categoría</label>
          <select id="transaction-category" {...register("category_id")} onChange={(event) => {
            setValue("category_id", event.target.value, { shouldValidate: true });
            setValue("subcategory_id", "");
          }}>
            <option value="">Selecciona…</option>
            {categories.filter((item) => item.is_active).map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}
          </select>
          {errors.category_id ? <p className="field-error">{errors.category_id.message}</p> : null}
        </div>
        <div className="field">
          <label htmlFor="transaction-subcategory">Subcategoría</label>
          <select id="transaction-subcategory" {...register("subcategory_id")} disabled={!categoryId}>
            <option value="">Sin subcategoría</option>
            {availableSubcategories.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}
          </select>
        </div>

        <div className="advanced-panel">
          <button className="button small" type="button" onClick={() => setAdvanced((value) => !value)}>
            Campos avanzados <ChevronDown size={15} style={{ transform: advanced ? "rotate(180deg)" : undefined }} />
          </button>
        </div>
        {advanced ? (
          <>
            <div className="field">
              <label htmlFor="transaction-context">Contexto</label>
              <input id="transaction-context" placeholder="Personal, Piso Málaga…" {...register("context")} />
            </div>
            <div className="field">
              <label htmlFor="transaction-platform">Plataforma</label>
              <input id="transaction-platform" placeholder="Airbnb, Booking…" {...register("platform")} />
            </div>
            <div className="field full">
              <label htmlFor="transaction-fiscal">Revisión fiscal del inmueble</label>
              <input id="transaction-fiscal" placeholder="Etiqueta orientativa, no conclusión fiscal" {...register("fiscal_property_status")} />
            </div>
            <div className="field full">
              <label htmlFor="transaction-notes">Notas</label>
              <textarea id="transaction-notes" placeholder="Información adicional" {...register("notes")} />
            </div>
          </>
        ) : null}
      </div>
      {submitError ? <p className="notice error">{submitError}</p> : null}
      <div className="form-actions">
        {onCancel ? <button className="button" type="button" onClick={onCancel}><X size={16} />Cancelar</button> : null}
        <button className="button primary" type="submit" disabled={isSubmitting}>
          {isSubmitting ? <LoaderCircle className="spin" size={16} /> : <Save size={16} />}
          {initial ? "Guardar cambios" : "Guardar movimiento"}
        </button>
      </div>
    </form>
  );
}
