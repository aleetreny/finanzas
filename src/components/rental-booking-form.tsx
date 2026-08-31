"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Check, ChevronDown, LoaderCircle, X } from "lucide-react";
import { useState } from "react";
import { useForm, useWatch, type UseFormRegisterReturn } from "react-hook-form";
import { z } from "zod";
import { useFinance } from "@/components/finance-provider";
import { formatCurrency, todayIso } from "@/lib/format";
import {
  calculateRentalBooking,
  defaultCommissionModel,
  RENTAL_COMMISSION_PROFILES,
} from "@/lib/property-rental";
import type {
  RentalBooking,
  RentalBookingInput,
  RentalCommissionModel,
  RentalPlatform,
} from "@/lib/types";

const bookingSchema = z.object({
  name: z.string().trim().min(2, "Indica un concepto para la reserva."),
  check_in_date: z.string().min(10, "Indica la entrada."),
  check_out_date: z.string().min(10, "Indica la salida."),
  platform: z.enum(["airbnb", "booking", "direct", "other"]),
  commission_model: z.enum(["airbnb_shared_legacy", "airbnb_host_only", "booking_standard", "direct", "other"]),
  notes: z.string().trim().max(2_000, "Las notas no pueden superar los 2.000 caracteres.").optional(),
  accommodation_final: z.number().min(0, "El alojamiento no puede ser negativo."),
  cleaning_fee: z.number().min(0, "La limpieza no puede ser negativa."),
  platform_commission_override_amount: z.number().min(0, "La comisión real no puede ser negativa.").nullable(),
  manager_payment_override_amount: z.number().min(0, "El pago real no puede ser negativo.").nullable(),
  payout_adjustment_amount: z.number().min(0, "El gasto o ajuste no puede ser negativo.").optional(),
  platform_rate_percent: z.number().min(0, "El porcentaje no puede ser negativo.").max(100, "El porcentaje no puede superar el 100 %."),
  manager_rate_percent: z.number().min(0, "El porcentaje no puede ser negativo.").max(100, "El porcentaje no puede superar el 100 %."),
}).superRefine((values, context) => {
  if (values.check_out_date <= values.check_in_date) {
    context.addIssue({ code: "custom", path: ["check_out_date"], message: "La salida debe ser posterior a la entrada." });
  }
  const expectedPlatform = RENTAL_COMMISSION_PROFILES[values.commission_model].platform;
  if (expectedPlatform !== values.platform) {
    context.addIssue({ code: "custom", path: ["platform"], message: "El modelo de comisión no coincide con la plataforma." });
  }
});

type BookingValues = z.infer<typeof bookingSchema>;

function addIsoDays(value: string, days: number) {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function defaultValues(initial?: RentalBooking): BookingValues {
  const platform = initial?.platform ?? "airbnb";
  const commissionModel = initial?.commission_model ?? defaultCommissionModel(platform);
  const profile = RENTAL_COMMISSION_PROFILES[commissionModel];
  const checkIn = initial?.check_in_date ?? todayIso();

  return {
    name: initial?.name ?? "Reserva",
    check_in_date: checkIn,
    check_out_date: initial?.check_out_date ?? addIsoDays(checkIn, 1),
    platform,
    commission_model: commissionModel,
    notes: initial?.notes ?? "",
    accommodation_final: initial
      ? Number(initial.accommodation_final)
      : (undefined as unknown as number),
    cleaning_fee: initial
      ? Number(initial.cleaning_fee)
      : 60,
    platform_commission_override_amount: initial?.platform_commission_override_amount == null
      ? null
      : Number(initial.platform_commission_override_amount),
    manager_payment_override_amount: initial?.manager_payment_override_amount == null
      ? null
      : Number(initial.manager_payment_override_amount),
    payout_adjustment_amount: Number(initial?.payout_adjustment_amount ?? 0) || undefined,
    platform_rate_percent: Number(initial?.platform_commission_rate ?? profile.platformRate) * 100,
    manager_rate_percent: Number(initial?.manager_rate ?? profile.managerRate) * 100,
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
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<BookingValues>({ resolver: zodResolver(bookingSchema), defaultValues: defaultValues(initial) });

  const values = useWatch({ control });
  const platform = values.platform ?? "airbnb";
  const calculation = calculateRentalBooking({
    checkInDate: values.check_in_date ?? "",
    checkOutDate: values.check_out_date ?? "",
    accommodationFinal: Number(values.accommodation_final ?? 0),
    cleaning: Number(values.cleaning_fee ?? 0),
    platformRate: Number(values.platform_rate_percent ?? 0) / 100,
    managerRate: Number(values.manager_rate_percent ?? 0) / 100,
    platformCommissionOverride: values.platform_commission_override_amount,
    managerPaymentOverride: values.manager_payment_override_amount,
    payoutAdjustment: values.payout_adjustment_amount,
  });

  function applyProfile(model: RentalCommissionModel) {
    const profile = RENTAL_COMMISSION_PROFILES[model];
    setValue("commission_model", model, { shouldDirty: true, shouldValidate: true });
    setValue("platform_rate_percent", profile.platformRate * 100, { shouldDirty: true });
    setValue("manager_rate_percent", profile.managerRate * 100, { shouldDirty: true });
  }

  const platformField = register("platform", {
    onChange: (event) => applyProfile(defaultCommissionModel(event.target.value as RentalPlatform)),
  });
  const modelField = register("commission_model", {
    onChange: (event) => applyProfile(event.target.value as RentalCommissionModel),
  });

  async function submit(formValues: BookingValues) {
    setSubmitError(null);
    const input: RentalBookingInput = {
      name: formValues.name.trim(),
      check_in_date: formValues.check_in_date,
      check_out_date: formValues.check_out_date,
      platform: formValues.platform,
      commission_model: formValues.commission_model,
      accommodation_final: formValues.accommodation_final,
      cleaning_fee: formValues.cleaning_fee,
      platform_commission_rate: formValues.platform_rate_percent / 100,
      platform_commission_override_amount: formValues.platform_commission_override_amount,
      manager_rate: formValues.manager_rate_percent / 100,
      manager_payment_override_amount: formValues.manager_payment_override_amount,
      payout_adjustment_amount: formValues.payout_adjustment_amount ?? 0,
      allocation_method: initial?.allocation_method ?? "daily",
      notes: formValues.notes?.trim() || null,
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
          Este cobro se importó desde el banco. Completa el periodo y los importes reales para dejarlo conciliado.
        </p>
      ) : null}

      <div className="field full">
        <label htmlFor="booking-name">Concepto</label>
        <input id="booking-name" placeholder="Reserva" {...register("name")} />
        {errors.name ? <p className="field-error">{errors.name.message}</p> : null}
      </div>

      <div className="rental-form-grid two">
        <div className="field">
          <label htmlFor="booking-start">Desde</label>
          <input id="booking-start" type="date" {...register("check_in_date")} />
          {errors.check_in_date ? <p className="field-error">{errors.check_in_date.message}</p> : null}
        </div>
        <div className="field">
          <label htmlFor="booking-end">Hasta</label>
          <input id="booking-end" type="date" {...register("check_out_date")} />
          {errors.check_out_date ? <p className="field-error">{errors.check_out_date.message}</p> : null}
        </div>
      </div>
      <p className="booking-night-count" aria-live="polite">
        {calculation.nights} {calculation.nights === 1 ? "noche" : "noches"} · la fecha de salida no cuenta como noche
      </p>

      <div className="field full">
        <label htmlFor="booking-platform">Plataforma</label>
        <select id="booking-platform" {...platformField}>
          <option value="airbnb">Airbnb</option>
          <option value="booking">Booking</option>
          <option value="direct">Directa</option>
          <option value="other">Otra</option>
        </select>
        {errors.platform ? <p className="field-error">{errors.platform.message}</p> : null}
      </div>

      {platform === "airbnb" ? (
        <div className="field full">
          <label htmlFor="booking-airbnb-model">Modelo de comisión de Airbnb</label>
          <select id="booking-airbnb-model" {...modelField}>
            <option value="airbnb_host_only">Comisión íntegra al propietario</option>
            <option value="airbnb_shared_legacy">Comisión compartida antigua</option>
          </select>
        </div>
      ) : <input type="hidden" {...modelField} />}

      <div className="rental-form-grid two">
        <MoneyField
          id="booking-accommodation"
          label="Alojamiento final (después de descuentos)"
          help="Sin incluir la limpieza."
          error={errors.accommodation_final?.message}
          register={register("accommodation_final", { setValueAs: decimalNumber })}
        />
        <MoneyField
          id="booking-cleaning"
          label="Limpieza"
          help="Se cobra al huésped y forma parte del pago a la gestora."
          error={errors.cleaning_fee?.message}
          register={register("cleaning_fee", { setValueAs: decimalNumber })}
        />
      </div>

      <div className="rental-calculation-preview">
        <PreviewRow label="Total bruto" value={calculation.totalGross} />
        <PreviewRow label="Comisión plataforma" value={-calculation.platformCommissionUsed} />
        <PreviewRow label="Pago total gestora" value={-calculation.managerPaymentUsed} />
        {calculation.payoutAdjustment > 0 ? <PreviewRow label="Gastos o ajustes adicionales" value={-calculation.payoutAdjustment} /> : null}
        <PreviewRow label="Neto propietario" value={calculation.ownerNet} total />
      </div>

      <details className="rental-advanced">
        <summary><ChevronDown size={16} />Ajustes avanzados</summary>
        <div className="rental-advanced-fields">
          <MoneyField
            id="booking-platform-real"
            label="Comisión real de plataforma"
            help={`Vacío: se usará ${formatCurrency(calculation.platformCommissionCalculated)}.`}
            optional
            error={errors.platform_commission_override_amount?.message}
            register={register("platform_commission_override_amount", { setValueAs: optionalNumber })}
          />
          <MoneyField
            id="booking-manager-real"
            label="Pago real al cohost o gestora"
            help={`Vacío: se usará ${formatCurrency(calculation.managerPaymentCalculated)}.`}
            optional
            error={errors.manager_payment_override_amount?.message}
            register={register("manager_payment_override_amount", { setValueAs: optionalNumber })}
          />
          <MoneyField
            id="booking-payout-adjustment"
            label="Gastos o ajustes adicionales"
            help="Se restan de tu cobro final después de calcular las comisiones (por ejemplo, un ajuste de Airbnb)."
            optional
            error={errors.payout_adjustment_amount?.message}
            register={register("payout_adjustment_amount", { setValueAs: optionalUndefinedNumber })}
          />
          <PercentField
            id="booking-platform-rate"
            label="Porcentaje de plataforma"
            error={errors.platform_rate_percent?.message}
            register={register("platform_rate_percent", { setValueAs: decimalNumber })}
          />
          <PercentField
            id="booking-manager-rate"
            label="Porcentaje de gestora"
            error={errors.manager_rate_percent?.message}
            register={register("manager_rate_percent", { setValueAs: decimalNumber })}
          />
          <div className="field full">
            <label htmlFor="booking-notes">Notas <span className="opt">· opcional</span></label>
            <textarea
              id="booking-notes"
              placeholder="Por ejemplo, ajuste pendiente o información de la reserva"
              {...register("notes")}
            />
            {errors.notes ? <p className="field-error">{errors.notes.message}</p> : null}
          </div>
        </div>
        <p className="form-help">Los porcentajes y el modelo quedan guardados dentro de esta reserva y no cambian si modificas perfiles futuros.</p>
      </details>

      {submitError ? <p className="notice error">{submitError}</p> : null}

      <div className="rental-form-actions">
        <button className="button" type="button" onClick={onCancel}><X size={16} />Cancelar</button>
        <button className="button primary" type="submit" disabled={isSubmitting}>
          {isSubmitting ? <LoaderCircle className="spin" size={17} /> : <Check size={17} />}
          {initial ? "Guardar reserva" : "Añadir reserva"}
        </button>
      </div>
    </form>
  );
}

function decimalNumber(value: unknown) {
  if (typeof value === "number") return value;
  if (value === "" || value === null || value === undefined) return undefined;
  const normalized = String(value).trim().replace(/\s/g, "").replace(",", ".");
  const number = Number(normalized);
  return Number.isFinite(number) ? number : undefined;
}

function optionalNumber(value: unknown) {
  const number = decimalNumber(value);
  return number === undefined ? null : number;
}

function optionalUndefinedNumber(value: unknown) {
  return decimalNumber(value);
}

function PreviewRow({ label, value, total = false }: { label: string; value: number; total?: boolean }) {
  return <div className={total ? "total" : ""}><span>{label}</span><strong className={value > 0 ? "positive" : value < 0 ? "negative" : ""}>{formatCurrency(value)}</strong></div>;
}

function MoneyField({
  id,
  label,
  help,
  optional = false,
  error,
  register,
}: {
  id: string;
  label: string;
  help?: string;
  optional?: boolean;
  error?: string;
  register: UseFormRegisterReturn;
}) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}{optional ? <span className="opt"> · opcional</span> : null}</label>
      <div className="money-input"><input id={id} type="text" inputMode="decimal" autoComplete="off" placeholder={optional ? "Automático" : undefined} {...register} /><span>€</span></div>
      {help ? <small>{help}</small> : null}
      {error ? <p className="field-error">{error}</p> : null}
    </div>
  );
}

function PercentField({ id, label, error, register }: { id: string; label: string; error?: string; register: UseFormRegisterReturn }) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className="money-input percentage-input"><input id={id} type="text" inputMode="decimal" autoComplete="off" {...register} /><span>%</span></div>
      {error ? <p className="field-error">{error}</p> : null}
    </div>
  );
}
