"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Building2, ChevronDown, Check, LoaderCircle, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { useFinance } from "@/components/finance-provider";
import { todayIso } from "@/lib/format";
import { colorForIndex } from "@/lib/palette";
import type { Transaction, TransactionInput } from "@/lib/types";

const formSchema = z.object({
  transaction_date: z.string().min(10, "Indica una fecha."),
  name: z.string().trim().min(2, "Ponle un nombre."),
  amount: z.number().positive("El importe debe ser mayor que cero."),
  direction: z.enum(["income", "expense"]),
  category_id: z.string().min(1, "Elige una categoría."),
  subcategory_id: z.string().optional(),
  context: z.string().optional(),
  platform: z.string().optional(),
  fiscal_property_status: z.string().optional(),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

const PISO_CONTEXT = "Piso Málaga";

function defaults(initial?: Transaction): FormValues {
  return {
    transaction_date: initial?.transaction_date ?? todayIso(),
    name: initial?.name ?? "",
    amount: initial ? Math.abs(initial.amount) : (undefined as unknown as number),
    direction: initial?.direction === "income" ? "income" : "expense",
    category_id: initial?.category_id ?? "",
    subcategory_id: initial?.subcategory_id ?? "",
    context: initial?.context ?? "",
    platform: initial?.platform ?? "",
    fiscal_property_status: initial?.fiscal_property_status ?? "",
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
  const [advanced, setAdvanced] = useState(Boolean(initial?.platform || initial?.notes || initial?.fiscal_property_status));
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

  const activeCategories = useMemo(() => categories.filter((item) => item.is_active), [categories]);
  const colorByCategory = useMemo(() => {
    const map = new Map<string, string>();
    activeCategories.forEach((item, index) => map.set(item.id, colorForIndex(index)));
    return map;
  }, [activeCategories]);

  const pisoCategory = useMemo(() => categories.find((item) => item.name === PISO_CONTEXT), [categories]);
  const pisoOn = Boolean(pisoCategory && categoryId === pisoCategory.id);

  const availableSubcategories = useMemo(
    () => subcategories.filter((item) => item.category_id === categoryId && item.is_active),
    [categoryId, subcategories],
  );

  const today = todayIso();
  const yesterday = shiftDay(-1);

  function pickCategory(id: string) {
    setValue("category_id", id, { shouldValidate: true });
    setValue("subcategory_id", "");
  }

  function togglePiso() {
    if (!pisoCategory) return;
    if (pisoOn) {
      setValue("category_id", "", { shouldValidate: true });
      setValue("subcategory_id", "");
      setValue("context", "");
    } else {
      setValue("category_id", pisoCategory.id, { shouldValidate: true });
      setValue("subcategory_id", "");
      setValue("context", PISO_CONTEXT);
    }
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
    <form className="quick-form" onSubmit={handleSubmit(submit)}>
      {/* Gasto / Ingreso */}
      <div className="seg" role="group" aria-label="Tipo de movimiento">
        <button type="button" className={`expense ${direction === "expense" ? "active" : ""}`} onClick={() => setValue("direction", "expense")}>
          Gasto
        </button>
        <button type="button" className={`income ${direction === "income" ? "active" : ""}`} onClick={() => setValue("direction", "income")}>
          Ingreso
        </button>
      </div>

      {/* Importe protagonista */}
      <div className={`amount-hero ${direction === "expense" ? "is-expense" : "is-income"}`} style={{ marginTop: 12 }}>
        <span className="cur">EUR</span>
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
        <span className="hint">{errors.amount ? errors.amount.message : direction === "expense" ? "Cuánto has gastado" : "Cuánto has ingresado"}</span>
      </div>

      {/* Atajo piso de Málaga (para la renta) */}
      {pisoCategory ? (
        <button type="button" className={`piso-toggle ${pisoOn ? "on" : ""}`} onClick={togglePiso} style={{ marginTop: 14 }} aria-pressed={pisoOn}>
          <span className="pt-icon"><Building2 size={18} /></span>
          <span className="pt-copy">
            <strong>Es del piso de Málaga</strong>
            <small>Lo separa para la declaración de la renta</small>
          </span>
          <span className="pt-switch" aria-hidden />
        </button>
      ) : null}

      {/* Categoría */}
      <div className="q-label">
        <span>Categoría</span>
        {errors.category_id ? <span className="opt" style={{ color: "var(--clay-ink)" }}>{errors.category_id.message}</span> : null}
      </div>
      <div className="chip-grid">
        {activeCategories.map((item) => (
          <button
            type="button"
            key={item.id}
            className={`chip ${categoryId === item.id ? "active" : ""}`}
            onClick={() => pickCategory(item.id)}
          >
            <span className="dot" style={{ background: colorByCategory.get(item.id) }} />
            {item.name}
          </button>
        ))}
      </div>

      {/* Subcategoría (aparece al elegir categoría) */}
      {availableSubcategories.length ? (
        <>
          <div className="q-label"><span>Subcategoría</span><span className="opt">opcional</span></div>
          <div className="chip-grid">
            {availableSubcategories.map((item) => (
              <button
                type="button"
                key={item.id}
                className={`chip sub ${subcategoryId === item.id ? "active" : ""}`}
                onClick={() => setValue("subcategory_id", subcategoryId === item.id ? "" : item.id)}
              >
                {item.name}
              </button>
            ))}
          </div>
        </>
      ) : null}

      {/* Concepto */}
      <div className="q-label"><span>Concepto</span></div>
      <div className="field full">
        <input
          type="text"
          placeholder={direction === "expense" ? "p. ej. Compra Mercadona" : "p. ej. Nómina"}
          {...register("name")}
        />
        {errors.name ? <p className="field-error">{errors.name.message}</p> : null}
      </div>

      {/* Fecha rápida */}
      <div className="q-label"><span>Fecha</span></div>
      <div className="q-date">
        <button type="button" className={`date-chip ${transactionDate === today ? "active" : ""}`} onClick={() => setValue("transaction_date", today)}>Hoy</button>
        <button type="button" className={`date-chip ${transactionDate === yesterday ? "active" : ""}`} onClick={() => setValue("transaction_date", yesterday)}>Ayer</button>
        <input type="date" aria-label="Otra fecha" {...register("transaction_date")} />
      </div>
      {errors.transaction_date ? <p className="field-error" style={{ marginTop: 6 }}>{errors.transaction_date.message}</p> : null}

      {/* Más detalles */}
      <button type="button" className="more-toggle" onClick={() => setAdvanced((value) => !value)} style={{ marginTop: 18 }}>
        Más detalles <ChevronDown size={14} style={{ transform: advanced ? "rotate(180deg)" : undefined, transition: "transform .15s ease" }} />
      </button>
      {advanced ? (
        <div className="form-grid" style={{ marginTop: 14 }}>
          {!pisoOn ? (
            <div className="field">
              <label htmlFor="tx-context">Contexto</label>
              <input id="tx-context" placeholder="Personal, Parking…" {...register("context")} />
            </div>
          ) : null}
          <div className="field">
            <label htmlFor="tx-platform">Plataforma</label>
            <input id="tx-platform" placeholder="Airbnb, Booking…" {...register("platform")} />
          </div>
          <div className="field full">
            <label htmlFor="tx-fiscal">Revisión fiscal del inmueble</label>
            <input id="tx-fiscal" placeholder="Etiqueta orientativa, no conclusión fiscal" {...register("fiscal_property_status")} />
          </div>
          <div className="field full">
            <label htmlFor="tx-notes">Notas</label>
            <textarea id="tx-notes" placeholder="Información adicional" {...register("notes")} />
          </div>
        </div>
      ) : null}

      {submitError ? <p className="notice error" style={{ marginTop: 16 }}>{submitError}</p> : null}

      {/* Guardar (fijo al pulgar en móvil) */}
      <div className="q-save">
        {onCancel ? (
          <button className="button" type="button" onClick={onCancel} style={{ width: "100%", marginBottom: 8 }}>
            <X size={16} />Cancelar
          </button>
        ) : null}
        <button className="button primary" type="submit" disabled={isSubmitting}>
          {isSubmitting ? <LoaderCircle className="spin" size={17} /> : <Check size={17} />}
          {initial ? "Guardar cambios" : "Anotar movimiento"}
        </button>
      </div>
    </form>
  );
}
