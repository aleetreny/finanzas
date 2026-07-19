"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Check, LoaderCircle, X } from "lucide-react";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useFinance } from "@/components/finance-provider";
import { todayIso } from "@/lib/format";
import type { PropertyRecurringInput, RecurringRule } from "@/lib/types";

const recurringSchema = z.object({
  name: z.string().trim().min(2, "Indica el concepto."),
  amount: z.number().positive("El importe debe ser mayor que cero."),
  frequency: z.enum(["monthly", "quarterly", "yearly"]),
  effective_from: z.string().min(10, "Indica cuándo empieza."),
  effective_until: z.string().optional(),
  subcategory_id: z.string().min(1, "Selecciona la categoría del gasto."),
  notes: z.string().optional(),
}).superRefine((values, context) => {
  if (values.effective_until && values.effective_until < values.effective_from) {
    context.addIssue({ code: "custom", path: ["effective_until"], message: "El final no puede ser anterior al inicio." });
  }
});

type RecurringValues = z.infer<typeof recurringSchema>;

function defaultValues(initial?: RecurringRule): RecurringValues {
  return {
    name: initial?.name ?? "",
    amount: Math.abs(Number(initial?.amount ?? 0)),
    frequency: initial?.frequency === "quarterly" || initial?.frequency === "yearly" ? initial.frequency : "monthly",
    effective_from: initial?.effective_from ?? todayIso(),
    effective_until: initial?.effective_until ?? "",
    subcategory_id: initial?.subcategory_id ?? "",
    notes: initial?.notes ?? "",
  };
}

export function PropertyRecurringForm({
  initial,
  onSaved,
  onCancel,
}: {
  initial?: RecurringRule;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const { categories, subcategories, savePropertyRecurring } = useFinance();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const propertyCategoryIds = useMemo(
    () => new Set(categories.filter((category) => category.category_scope === "property").map((category) => category.id)),
    [categories],
  );
  const expenseSubcategories = useMemo(
    () => subcategories.filter((subcategory) => {
      const name = subcategory.name.toLocaleLowerCase("es");
      return propertyCategoryIds.has(subcategory.category_id)
        && (subcategory.is_active || subcategory.id === initial?.subcategory_id)
        && !name.startsWith("ingreso")
        && !name.startsWith("reembolso");
    }),
    [initial?.subcategory_id, propertyCategoryIds, subcategories],
  );
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RecurringValues>({ resolver: zodResolver(recurringSchema), defaultValues: defaultValues(initial) });

  async function submit(values: RecurringValues) {
    setSubmitError(null);
    const input: PropertyRecurringInput = {
      ...values,
      name: values.name.trim(),
      effective_until: values.effective_until || null,
      notes: values.notes?.trim() || null,
    };
    try {
      await savePropertyRecurring(input, initial?.id);
      onSaved();
    } catch (caught) {
      setSubmitError(caught instanceof Error ? caught.message : "No se pudo guardar el gasto recurrente.");
    }
  }

  return (
    <form className="rental-form" onSubmit={handleSubmit(submit)}>
      <div className="rental-form-grid two">
        <div className="field">
          <label htmlFor="recurring-name">Concepto</label>
          <input id="recurring-name" placeholder="p. ej. Comunidad" {...register("name")} />
          {errors.name ? <p className="field-error">{errors.name.message}</p> : null}
        </div>
        <div className="field">
          <label htmlFor="recurring-amount">Importe</label>
          <div className="money-input"><input id="recurring-amount" type="number" min="0.01" step="0.01" inputMode="decimal" {...register("amount", { valueAsNumber: true })} /><span>€</span></div>
          {errors.amount ? <p className="field-error">{errors.amount.message}</p> : null}
        </div>
      </div>

      <div className="rental-form-grid two">
        <div className="field">
          <label htmlFor="recurring-frequency">Periodicidad</label>
          <select id="recurring-frequency" {...register("frequency")}>
            <option value="monthly">Mensual</option>
            <option value="quarterly">Trimestral</option>
            <option value="yearly">Anual</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="recurring-category">Categoría</label>
          <select id="recurring-category" {...register("subcategory_id")}>
            <option value="">Selecciona una categoría…</option>
            {expenseSubcategories.map((subcategory) => <option key={subcategory.id} value={subcategory.id}>{subcategory.name}</option>)}
          </select>
          {errors.subcategory_id ? <p className="field-error">{errors.subcategory_id.message}</p> : null}
        </div>
      </div>

      <div className="rental-form-grid two">
        <div className="field">
          <label htmlFor="recurring-start">Empieza</label>
          <input id="recurring-start" type="date" {...register("effective_from")} />
          {errors.effective_from ? <p className="field-error">{errors.effective_from.message}</p> : null}
        </div>
        <div className="field">
          <label htmlFor="recurring-end">Termina <span className="opt">opcional</span></label>
          <input id="recurring-end" type="date" {...register("effective_until")} />
          {errors.effective_until ? <p className="field-error">{errors.effective_until.message}</p> : null}
        </div>
      </div>

      <div className="field full">
        <label htmlFor="recurring-notes">Notas</label>
        <textarea id="recurring-notes" placeholder="Información adicional" {...register("notes")} />
      </div>

      <p className="form-help">El gasto aparecerá automáticamente cuando llegue cada periodo; no crea duplicados mensuales en el banco.</p>
      {submitError ? <p className="notice error">{submitError}</p> : null}

      <div className="rental-form-actions">
        <button className="button" type="button" onClick={onCancel}><X size={16} />Cancelar</button>
        <button className="button primary" type="submit" disabled={isSubmitting}>
          {isSubmitting ? <LoaderCircle className="spin" size={17} /> : <Check size={17} />}
          {initial ? "Guardar cambios" : "Guardar gasto periódico"}
        </button>
      </div>
    </form>
  );
}
