"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Check, LoaderCircle, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { useFinance } from "@/components/finance-provider";
import { parseLocalizedDecimal } from "@/lib/decimal-input";
import { todayIso } from "@/lib/format";
import type { RecurringInput, RecurringRule } from "@/lib/types";

const recurringSchema = z.object({
  direction: z.enum(["expense", "income"]),
  name: z.string().trim().min(2, "Indica un concepto reconocible."),
  amount: z.number().positive("El importe debe ser mayor que cero."),
  frequency: z.enum(["weekly", "monthly", "quarterly", "yearly"]),
  effective_from: z.string().min(10, "Indica cuándo empieza."),
  effective_until: z.string().optional(),
  category_id: z.string().min(1, "Selecciona una categoría."),
  subcategory_id: z.string().optional(),
  notes: z.string().optional(),
}).superRefine((values, context) => {
  if (values.effective_until && values.effective_until < values.effective_from) {
    context.addIssue({
      code: "custom",
      path: ["effective_until"],
      message: "La fecha final no puede ser anterior a la inicial.",
    });
  }
});

type RecurringValues = z.infer<typeof recurringSchema>;

function defaults(initial?: RecurringRule): RecurringValues {
  return {
    direction: Number(initial?.amount ?? -1) >= 0 ? "income" : "expense",
    name: initial?.name ?? "",
    amount: initial ? Math.abs(Number(initial.amount)) : (undefined as unknown as number),
    frequency: initial?.frequency ?? "monthly",
    effective_from: initial?.effective_from ?? todayIso(),
    effective_until: initial?.effective_until ?? "",
    category_id: initial?.category_id ?? "",
    subcategory_id: initial?.subcategory_id ?? "",
    notes: initial?.notes ?? "",
  };
}

export function RecurringForm({
  initial,
  onSaved,
  onCancel,
}: {
  initial?: RecurringRule;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const { categories, subcategories, saveRecurring } = useFinance();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setValue,
    control,
    formState: { errors, isSubmitting },
  } = useForm<RecurringValues>({
    resolver: zodResolver(recurringSchema),
    defaultValues: defaults(initial),
  });
  const direction = useWatch({ control, name: "direction" });
  const categoryId = useWatch({ control, name: "category_id" });
  const availableCategories = useMemo(
    () => categories.filter((category) =>
      category.category_scope === direction
      && (category.is_active || category.id === initial?.category_id)),
    [categories, direction, initial?.category_id],
  );
  const availableSubcategories = useMemo(
    () => subcategories.filter((subcategory) =>
      subcategory.category_id === categoryId
      && (subcategory.is_active || subcategory.id === initial?.subcategory_id)),
    [categoryId, initial?.subcategory_id, subcategories],
  );

  useEffect(() => {
    if (availableCategories.some((category) => category.id === categoryId)) return;
    setValue("category_id", availableCategories.length === 1 ? availableCategories[0].id : "");
    setValue("subcategory_id", "");
  }, [availableCategories, categoryId, setValue]);

  async function submit(values: RecurringValues) {
    setSubmitError(null);
    const input: RecurringInput = {
      direction: values.direction,
      name: values.name.trim(),
      amount: Math.abs(values.amount),
      frequency: values.frequency,
      effective_from: values.effective_from,
      effective_until: values.effective_until || null,
      category_id: values.category_id,
      subcategory_id: values.subcategory_id || null,
      notes: values.notes?.trim() || null,
    };
    try {
      await saveRecurring(input, initial?.id);
      onSaved();
    } catch (caught) {
      setSubmitError(caught instanceof Error ? caught.message : "No se pudo guardar el recurrente.");
    }
  }

  return (
    <form className="rental-form recurring-form" onSubmit={handleSubmit(submit)}>
      <div className="seg" role="group" aria-label="Tipo de recurrente">
        <button
          type="button"
          className={`expense ${direction === "expense" ? "active" : ""}`}
          aria-pressed={direction === "expense"}
          onClick={() => setValue("direction", "expense")}
        >
          Gasto
        </button>
        <button
          type="button"
          className={`income ${direction === "income" ? "active" : ""}`}
          aria-pressed={direction === "income"}
          onClick={() => setValue("direction", "income")}
        >
          Ingreso
        </button>
      </div>

      <div className="rental-form-grid two">
        <div className="field">
          <label htmlFor="general-recurring-name">Concepto</label>
          <input id="general-recurring-name" placeholder={direction === "expense" ? "p. ej. Alquiler" : "p. ej. Nómina"} autoFocus {...register("name")} />
          {errors.name ? <p className="field-error">{errors.name.message}</p> : null}
        </div>
        <div className="field">
          <label htmlFor="general-recurring-amount">Importe</label>
          <div className="money-input">
            <input
              id="general-recurring-amount"
              type="text"
              inputMode="decimal"
              autoComplete="off"
              {...register("amount", { setValueAs: parseLocalizedDecimal })}
            />
            <span>€</span>
          </div>
          {errors.amount ? <p className="field-error">{errors.amount.message}</p> : null}
        </div>
      </div>

      <div className="rental-form-grid two">
        <div className="field">
          <label htmlFor="general-recurring-frequency">Periodicidad</label>
          <select id="general-recurring-frequency" {...register("frequency")}>
            <option value="weekly">Semanal</option>
            <option value="monthly">Mensual</option>
            <option value="quarterly">Trimestral</option>
            <option value="yearly">Anual</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="general-recurring-category">Categoría</label>
          <select
            id="general-recurring-category"
            {...register("category_id", {
              onChange: () => setValue("subcategory_id", ""),
            })}
          >
            <option value="">Selecciona una categoría…</option>
            {availableCategories.map((category) => (
              <option key={category.id} value={category.id}>{category.name}</option>
            ))}
          </select>
          {errors.category_id ? <p className="field-error">{errors.category_id.message}</p> : null}
        </div>
      </div>

      <div className="rental-form-grid two">
        <div className="field">
          <label htmlFor="general-recurring-subcategory">Subcategoría <span className="opt">opcional</span></label>
          <select id="general-recurring-subcategory" disabled={!categoryId || !availableSubcategories.length} {...register("subcategory_id")}>
            <option value="">{availableSubcategories.length ? "Sin subcategoría" : "No hay subcategorías"}</option>
            {availableSubcategories.map((subcategory) => (
              <option key={subcategory.id} value={subcategory.id}>{subcategory.name}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="general-recurring-start">Primera fecha</label>
          <input id="general-recurring-start" type="date" {...register("effective_from")} />
          {errors.effective_from ? <p className="field-error">{errors.effective_from.message}</p> : null}
        </div>
      </div>

      <div className="rental-form-grid two recurring-last-row">
        <div className="field">
          <label htmlFor="general-recurring-end">Última fecha <span className="opt">opcional</span></label>
          <input id="general-recurring-end" type="date" {...register("effective_until")} />
          {errors.effective_until ? <p className="field-error">{errors.effective_until.message}</p> : null}
        </div>
        <div className="field">
          <label htmlFor="general-recurring-notes">Notas <span className="opt">opcional</span></label>
          <textarea id="general-recurring-notes" placeholder="Lo que quieras recordar" {...register("notes")} />
        </div>
      </div>

      <p className="form-help">
        Se añadirá un apunte en cada fecha que corresponda. Si editas o pausas la regla, los apuntes históricos se conservan.
      </p>
      {submitError ? <p className="notice error" role="alert">{submitError}</p> : null}

      <div className="rental-form-actions">
        <button className="button" type="button" onClick={onCancel} disabled={isSubmitting}><X size={16} />Cancelar</button>
        <button className="button primary" type="submit" disabled={isSubmitting || !availableCategories.length}>
          {isSubmitting ? <LoaderCircle className="spin" size={17} /> : <Check size={17} />}
          {initial ? "Guardar cambios" : "Crear recurrente"}
        </button>
      </div>
    </form>
  );
}
