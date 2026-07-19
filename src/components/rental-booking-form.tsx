"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Check, LoaderCircle, X } from "lucide-react";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { useFinance } from "@/components/finance-provider";
import { formatCurrency, todayIso } from "@/lib/format";
import type { RentalBooking, RentalBookingInput } from "@/lib/types";

const bookingSchema = z.object({
  name: z.string().trim().min(2, "Indica un nombre para la reserva."),
  check_in_date: z.string().min(10, "Indica el inicio."),
  check_out_date: z.string().min(10, "Indica el final."),
  gross_before_discount: z.number().min(0, "El importe no puede ser negativo."),
  discount_amount: z.number().min(0, "El descuento no puede ser negativo."),
  platform_commission_amount: z.number().min(0, "La comisión no puede ser negativa."),
  manager_commission_amount: z.number().min(0, "La comisión no puede ser negativa."),
  manager_cleaning_amount: z.number().min(0, "La limpieza no puede ser negativa."),
  allocation_method: z.enum(["daily", "monthly"]),
  notes: z.string().optional(),
}).superRefine((values, context) => {
  if (values.check_out_date < values.check_in_date) {
    context.addIssue({ code: "custom", path: ["check_out_date"], message: "El final no puede ser anterior al inicio." });
  }
  if (values.discount_amount > values.gross_before_discount) {
    context.addIssue({ code: "custom", path: ["discount_amount"], message: "El descuento supera el importe bruto." });
  }
});

type BookingValues = z.infer<typeof bookingSchema>;

function defaultValues(initial?: RentalBooking): BookingValues {
  return {
    name: initial?.name ?? "Alquiler",
    check_in_date: initial?.check_in_date ?? todayIso(),
    check_out_date: initial?.check_out_date ?? todayIso(),
    gross_before_discount: Number(initial?.gross_before_discount ?? 0),
    discount_amount: Number(initial?.discount_amount ?? 0),
    platform_commission_amount: Number(initial?.platform_commission_amount ?? 0),
    manager_commission_amount: Number(initial?.manager_commission_amount ?? 0),
    manager_cleaning_amount: Number(initial?.manager_cleaning_amount ?? 0),
    allocation_method: initial?.allocation_method ?? "daily",
    notes: initial?.notes ?? "",
  };
}

export function RentalBookingForm({
  initial,
  onSaved,
  onCancel,
}: {
  initial?: RentalBooking;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const { saveBooking } = useFinance();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<BookingValues>({ resolver: zodResolver(bookingSchema), defaultValues: defaultValues(initial) });

  const amounts = useWatch({ control });
  const previewNet = Number(amounts.gross_before_discount ?? 0)
    - Number(amounts.discount_amount ?? 0)
    - Number(amounts.platform_commission_amount ?? 0)
    - Number(amounts.manager_commission_amount ?? 0)
    - Number(amounts.manager_cleaning_amount ?? 0);

  async function submit(values: BookingValues) {
    setSubmitError(null);
    const input: RentalBookingInput = {
      ...values,
      name: values.name.trim(),
      notes: values.notes?.trim() || null,
    };
    try {
      await saveBooking(input, initial?.id);
      onSaved();
    } catch (caught) {
      setSubmitError(caught instanceof Error ? caught.message : "No se pudo guardar la reserva.");
    }
  }

  return (
    <form className="rental-form" onSubmit={handleSubmit(submit)}>
      {initial?.calculation_status === "needs_review" ? (
        <p className="notice rental-review-notice">
          Este cobro se importó con el importe bancario. Completa el periodo y el desglose para dejarlo conciliado.
        </p>
      ) : null}

      <div className="field full">
        <label htmlFor="booking-name">Concepto</label>
        <input id="booking-name" placeholder="Alquiler" {...register("name")} />
        {errors.name ? <p className="field-error">{errors.name.message}</p> : null}
      </div>

      <div className="rental-form-grid two">
        <div className="field">
          <label htmlFor="booking-start">Desde</label>
          <input id="booking-start" type="date" {...register("check_in_date")} />
          {errors.check_in_date ? <p className="field-error">{errors.check_in_date.message}</p> : null}
        </div>
        <div className="field">
          <label htmlFor="booking-end">Hasta, incluido</label>
          <input id="booking-end" type="date" {...register("check_out_date")} />
          {errors.check_out_date ? <p className="field-error">{errors.check_out_date.message}</p> : null}
        </div>
      </div>

      <div className="rental-form-grid">
        <MoneyField id="booking-gross" label="Importe del cliente, antes de descuentos" error={errors.gross_before_discount?.message} register={register("gross_before_discount", { valueAsNumber: true })} />
        <MoneyField id="booking-discount" label="Descuentos" error={errors.discount_amount?.message} register={register("discount_amount", { valueAsNumber: true })} />
        <MoneyField id="booking-platform" label="Comisión plataforma" error={errors.platform_commission_amount?.message} register={register("platform_commission_amount", { valueAsNumber: true })} />
        <MoneyField id="booking-manager" label="Comisión gestor" error={errors.manager_commission_amount?.message} register={register("manager_commission_amount", { valueAsNumber: true })} />
        <MoneyField id="booking-cleaning" label="Limpieza, la recibe el gestor" error={errors.manager_cleaning_amount?.message} register={register("manager_cleaning_amount", { valueAsNumber: true })} />
      </div>

      <div className="rental-net-preview">
        <span>Neto de la reserva</span>
        <strong className={previewNet >= 0 ? "positive" : ""}>{formatCurrency(previewNet)}</strong>
      </div>

      <div className="field full">
        <label htmlFor="booking-allocation">Reparto entre meses</label>
        <select id="booking-allocation" {...register("allocation_method")}>
          <option value="daily">Proporcional a los días de cada mes</option>
          <option value="monthly">Mismo importe por cada mes incluido</option>
        </select>
        <small>Para alquileres mensuales completos usa el reparto igual por meses.</small>
      </div>

      <div className="field full">
        <label htmlFor="booking-notes">Notas</label>
        <textarea id="booking-notes" placeholder="Información adicional de la reserva" {...register("notes")} />
      </div>

      {submitError ? <p className="notice error">{submitError}</p> : null}

      <div className="rental-form-actions">
        <button className="button" type="button" onClick={onCancel}><X size={16} />Cancelar</button>
        <button className="button primary" type="submit" disabled={isSubmitting}>
          {isSubmitting ? <LoaderCircle className="spin" size={17} /> : <Check size={17} />}
          {initial ? "Guardar desglose" : "Guardar reserva"}
        </button>
      </div>
    </form>
  );
}

function MoneyField({
  id,
  label,
  error,
  register,
}: {
  id: string;
  label: string;
  error?: string;
  register: React.InputHTMLAttributes<HTMLInputElement>;
}) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className="money-input"><input id={id} type="number" min="0" step="0.01" inputMode="decimal" {...register} /><span>€</span></div>
      {error ? <p className="field-error">{error}</p> : null}
    </div>
  );
}
