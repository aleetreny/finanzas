"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Check, ChevronDown, LoaderCircle, MapPinned, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { AppLink } from "@/components/app-link";
import { useFinance } from "@/components/finance-provider";
import { todayIso } from "@/lib/format";
import { navigateToAppRoute } from "@/lib/navigation";
import type { Transaction, TransactionInput } from "@/lib/types";

const formSchema = z.object({
  transaction_date: z.string().min(10, "Indica una fecha."),
  allocation_start_date: z.string().optional(),
  allocation_end_date: z.string().optional(),
  name: z.string().trim().min(2, "Ponle un nombre."),
  amount: z.number().positive("El importe debe ser mayor que cero."),
  direction: z.enum(["income", "expense"]),
  category_id: z.string().min(1, "Elige una categoría."),
  subcategory_id: z.string().optional(),
  trip_project_id: z.string().optional(),
  notes: z.string().optional(),
}).superRefine((values, context) => {
  const hasStart = Boolean(values.allocation_start_date);
  const hasEnd = Boolean(values.allocation_end_date);
  if (hasStart !== hasEnd) {
    if (!hasStart) {
      context.addIssue({ code: "custom", path: ["allocation_start_date"], message: "Indica también el inicio del periodo." });
    }
    if (!hasEnd) {
      context.addIssue({ code: "custom", path: ["allocation_end_date"], message: "Indica también el final del periodo." });
    }
  }
  if (hasStart && hasEnd && values.allocation_end_date! < values.allocation_start_date!) {
    context.addIssue({ code: "custom", path: ["allocation_end_date"], message: "El final no puede ser anterior al inicio." });
  }
});

type FormValues = z.infer<typeof formSchema>;

function defaults(initial?: Transaction, fixedDirection?: "income" | "expense"): FormValues {
  return {
    transaction_date: initial?.transaction_date ?? todayIso(),
    allocation_start_date: initial?.allocation_start_date ?? "",
    allocation_end_date: initial?.allocation_end_date ?? "",
    name: initial?.name ?? "",
    amount: initial ? Math.abs(initial.amount) : (undefined as unknown as number),
    direction: fixedDirection ?? (initial?.direction === "income" ? "income" : "expense"),
    category_id: initial?.category_id ?? "",
    subcategory_id: initial?.subcategory_id ?? "",
    trip_project_id: initial?.trip_project_id ?? "",
    notes: initial?.notes ?? "",
  };
}

// Igual que todayIso: siempre sobre la fecha local, nunca la UTC.
function shiftDay(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function TransactionForm({
  initial,
  onSaved,
  onCancel,
  onDelete,
  isDeleting = false,
  scope = "general",
  fixedDirection,
}: {
  initial?: Transaction;
  onSaved?: () => void;
  onCancel?: () => void;
  onDelete?: () => void | Promise<void>;
  isDeleting?: boolean;
  scope?: "general" | "property";
  fixedDirection?: "income" | "expense";
}) {
  const { categories, subcategories, tripProjects, addTransaction, updateTransaction } = useFinance();
  const [advanced, setAdvanced] = useState(Boolean(initial?.notes || initial?.allocation_start_date || initial?.allocation_end_date));
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [selectionError, setSelectionError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    setFocus,
    control,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(formSchema), defaultValues: defaults(initial, fixedDirection) });

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
    () => subcategories.filter((subcategory) => {
      if (subcategory.category_id !== categoryId || !subcategory.is_active) return false;
      if (scope !== "property") return true;
      const name = subcategory.name.toLocaleLowerCase("es");
      const incomeConcept = name.startsWith("ingreso") || name.startsWith("reembolso");
      return direction === "income" ? incomeConcept : !incomeConcept;
    }),
    [categoryId, direction, scope, subcategories],
  );
  const usesSubcategorySelector = scope === "property" || direction === "income";
  const availableTrips = useMemo(
    () => tripProjects.filter((project) => project.is_active || project.id === initial?.trip_project_id),
    [initial?.trip_project_id, tripProjects],
  );

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

  useEffect(() => {
    if (scope === "property" || direction === "income") {
      setValue("trip_project_id", "");
    }
  }, [direction, scope, setValue]);

  function pickCategory(id: string) {
    setValue("category_id", id, { shouldValidate: true });
    setValue("subcategory_id", "");
    setSelectionError(null);
  }

  function dismissVirtualKeyboard() {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  }

  function dismissKeyboardAfterTap(event: React.MouseEvent<HTMLFormElement>) {
    const target = event.target;
    const activeElement = document.activeElement;
    if (!(target instanceof Element) || !(activeElement instanceof HTMLElement)) return;
    if (!activeElement.matches("input, textarea, select")) return;
    if (target.closest("input, textarea, select")) return;
    // WebKit puede cancelar el cambio del botón pulsado si el input pierde el
    // foco dentro del mismo evento. Se difiere al siguiente frame.
    window.requestAnimationFrame(dismissVirtualKeyboard);
  }

  async function submit(values: FormValues) {
    setSubmitError(null);
    if (usesSubcategorySelector && availableSubcategories.length && !values.subcategory_id) {
      setSelectionError(direction === "income" && scope === "general" ? "Elige el tipo de ingreso." : "Elige el tipo de apunte.");
      setFocus("subcategory_id");
      return;
    }
    setSelectionError(null);
    dismissVirtualKeyboard();

    const input: TransactionInput = {
      transaction_date: values.transaction_date,
      allocation_start_date: values.allocation_start_date || null,
      allocation_end_date: values.allocation_end_date || null,
      name: values.name.trim(),
      amount: values.direction === "expense" ? -Math.abs(values.amount) : Math.abs(values.amount),
      direction: values.direction,
      category_id: values.category_id,
      subcategory_id: values.subcategory_id || null,
      context: scope === "property"
        ? "Piso Málaga"
        : values.trip_project_id
          ? null
          : initial?.context ?? null,
      platform: null,
      trip_project_id: scope === "general" && values.direction === "expense"
        ? values.trip_project_id || null
        : null,
      fiscal_property_status: null,
      notes: values.notes || null,
    };

    try {
      if (initial) await updateTransaction(initial.id, input);
      else await addTransaction(input);
      if (onSaved) onSaved();
      else navigateToAppRoute(scope === "property" ? "/piso-malaga" : "/movimientos");
    } catch (caught) {
      setSubmitError(caught instanceof Error ? caught.message : "No se pudo guardar el movimiento.");
    }
  }

  const [rawAmount, setRawAmount] = useState<string>(() =>
    initial && typeof initial.amount === "number" && !isNaN(initial.amount)
      ? String(Math.abs(initial.amount)).replace(".", ",")
      : ""
  );

  useEffect(() => {
    register("amount", { required: true });
  }, [register]);

  function handleAmountChange(e: React.ChangeEvent<HTMLInputElement>) {
    const inputVal = e.target.value;
    const displayVal = inputVal.replace(/[^0-9.,]/g, "");

    const parts = displayVal.split(/[.,]/);
    let finalDisplay = displayVal;
    if (parts.length > 2) {
      const sep = displayVal.includes(",") ? "," : ".";
      finalDisplay = parts[0] + sep + parts.slice(1).join("");
    }
    setRawAmount(finalDisplay);

    const normalized = finalDisplay.replace(",", ".");
    const parsed = parseFloat(normalized);
    if (!isNaN(parsed) && parsed > 0) {
      setValue("amount", parsed, { shouldValidate: true });
    } else {
      setValue("amount", undefined as unknown as number, { shouldValidate: true });
    }
  }

  return (
    <form
      className="quick-form"
      aria-busy={isSubmitting}
      onClick={dismissKeyboardAfterTap}
      onTouchMove={dismissVirtualKeyboard}
      onSubmit={handleSubmit(submit)}
    >
      {!fixedDirection ? (
        <div className="seg" role="group" aria-label="Tipo de movimiento">
          <button type="button" className={`expense ${direction === "expense" ? "active" : ""}`} onClick={() => setValue("direction", "expense")}>Gasto</button>
          <button type="button" className={`income ${direction === "income" ? "active" : ""}`} onClick={() => setValue("direction", "income")}>Ingreso</button>
        </div>
      ) : null}

      <div className="amount-hero">
        <span className="cur">euros</span>
        <input
          type="text"
          inputMode="decimal"
          placeholder="0"
          aria-label="Importe en euros"
          aria-invalid={Boolean(errors.amount)}
          autoComplete="off"
          enterKeyHint="done"
          value={rawAmount}
          onChange={handleAmountChange}
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
            {selectionError ? <p className="field-error" role="alert">{selectionError}</p> : null}
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
        <input
          type="text"
          aria-label="Concepto"
          aria-invalid={Boolean(errors.name)}
          autoComplete="off"
          enterKeyHint="done"
          placeholder={direction === "expense" ? "p. ej. compra del super" : "p. ej. nómina"}
          {...register("name")}
        />
        {errors.name ? <p className="field-error">{errors.name.message}</p> : null}
      </div>

      <div className="q-label">Fecha</div>
      <div className="q-date">
        <button type="button" className={`date-chip ${transactionDate === today ? "active" : ""}`} onClick={() => setValue("transaction_date", today)}>Hoy</button>
        <button type="button" className={`date-chip ${transactionDate === yesterday ? "active" : ""}`} onClick={() => setValue("transaction_date", yesterday)}>Ayer</button>
        <input type="date" aria-label="Otra fecha" {...register("transaction_date")} />
      </div>
      {errors.transaction_date ? <p className="field-error" style={{ marginTop: 6 }}>{errors.transaction_date.message}</p> : null}

      {scope === "general" && direction === "expense" ? (
        <section className="trip-picker" aria-labelledby="trip-picker-label">
          <div className="trip-picker-heading">
            <div>
              <div className="q-label" id="trip-picker-label">
                Viaje <span className="opt">opcional</span>
              </div>
              <p>Agrupa el gasto sin escribir el nombre a mano.</p>
            </div>
            <MapPinned size={22} aria-hidden="true" />
          </div>
          <div className="trip-picker-controls">
            <div className="field">
              <label htmlFor="tx-trip">Asignar a</label>
              <select id="tx-trip" {...register("trip_project_id")}>
                <option value="">Ningún viaje</option>
                {availableTrips.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}{project.is_active ? "" : " (cerrado)"}
                  </option>
                ))}
              </select>
            </div>
            <AppLink href="/viajes" className="button small">
              {availableTrips.length ? "Gestionar viajes" : "Crear un viaje"}
            </AppLink>
          </div>
        </section>
      ) : null}

      <button type="button" className="more-toggle" aria-expanded={advanced} onClick={() => setAdvanced((value) => !value)} style={{ marginTop: 18 }}>
        Más detalles <ChevronDown size={15} style={{ transform: advanced ? "rotate(180deg)" : undefined, transition: "transform .15s ease" }} />
      </button>
      {advanced ? (
        <div style={{ display: "grid", gap: 16, marginTop: 14 }}>
          <div>
            <div className="q-label" style={{ marginTop: 0 }}>
              Periodo al que corresponde <span className="opt">opcional</span>
            </div>
            <div className="rental-form-grid two">
              <div className="field">
                <label htmlFor="tx-allocation-start">Imputar desde</label>
                <input id="tx-allocation-start" type="date" {...register("allocation_start_date")} />
                {errors.allocation_start_date ? <p className="field-error">{errors.allocation_start_date.message}</p> : null}
              </div>
              <div className="field">
                <label htmlFor="tx-allocation-end">Imputar hasta</label>
                <input id="tx-allocation-end" type="date" {...register("allocation_end_date")} />
                {errors.allocation_end_date ? <p className="field-error">{errors.allocation_end_date.message}</p> : null}
              </div>
            </div>
            <p className="form-help" style={{ marginTop: 8 }}>
              Si lo rellenas, los análisis mensuales reparten el importe por días entre esas fechas. La fecha del cargo bancario no cambia.
            </p>
          </div>
          <div className="field">
            <label htmlFor="tx-notes">Notas</label>
            <textarea id="tx-notes" placeholder="Lo que quieras recordar" {...register("notes")} />
          </div>
        </div>
      ) : null}

      {submitError ? <p className="notice error" role="alert" style={{ marginTop: 16 }}>{submitError}</p> : null}

      <div className="q-save">
        {onCancel || (initial && onDelete) ? (
          <div className="q-secondary-actions">
            {onCancel ? (
              <button className="button" type="button" onClick={onCancel} disabled={isDeleting}><X size={16} />Cancelar</button>
            ) : null}
            {initial && onDelete ? (
              <button className="button danger" type="button" onClick={() => void onDelete()} disabled={isSubmitting || isDeleting}>
                {isDeleting ? <LoaderCircle className="spin" size={17} /> : <Trash2 size={17} />}
                {isDeleting ? "Eliminando…" : "Eliminar"}
              </button>
            ) : null}
          </div>
        ) : null}
        <button className="button primary" type="submit" disabled={isSubmitting || isDeleting || !availableCategories.length}>
          {isSubmitting ? <LoaderCircle className="spin" size={18} /> : <Check size={18} />}
          {initial ? "Guardar cambios" : "Anotar"}
        </button>
      </div>
    </form>
  );
}
