"use client";

import { Calculator, LoaderCircle, Save } from "lucide-react";
import { useMemo, useState } from "react";
import { useFinance } from "@/components/finance-provider";
import { PageHeader } from "@/components/page-header";
import { calculateAirbnb, calculateBooking } from "@/lib/calculations";
import { formatCurrency } from "@/lib/format";

function NumberField({ label, value, onChange, step = "0.01" }: { label: string; value: number; onChange: (value: number) => void; step?: string }) {
  return <div className="field"><label>{label}</label><input type="number" inputMode="decimal" step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} /></div>;
}

export function ReservationsView() {
  const { bookings, saveBooking } = useFinance();
  const [platform, setPlatform] = useState<"airbnb" | "booking">("airbnb");
  const [payout, setPayout] = useState(883.55);
  const [discount, setDiscount] = useState(148.9);
  const [cleaning, setCleaning] = useState(60);
  const [managerRate, setManagerRate] = useState(18);
  const [platformRate, setPlatformRate] = useState(18.755);
  const [bankRate, setBankRate] = useState(1.3);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const result = useMemo(() => platform === "airbnb"
    ? calculateAirbnb({ payoutReceived: payout, discountAmount: discount, cleaningFee: cleaning, managerRate: managerRate / 100, platformRate: platformRate / 100 })
    : calculateBooking({ payoutReceived: payout, discountAmount: discount, cleaningFee: cleaning, managerRate: managerRate / 100, platformRate: platformRate / 100, bankRate: bankRate / 100 }),
  [bankRate, cleaning, discount, managerRate, payout, platform, platformRate]);

  function choosePlatform(next: "airbnb" | "booking") {
    setPlatform(next);
    if (next === "airbnb") {
      setPayout(883.55); setDiscount(148.9); setCleaning(60); setPlatformRate(18.755); setBankRate(0);
    } else {
      setPayout(274.03); setDiscount(0); setCleaning(70); setPlatformRate(15); setBankRate(1.3);
    }
  }

  async function save() {
    setSaving(true);
    setMessage(null);
    try {
      await saveBooking({
        platform,
        booking_date: new Date().toISOString().slice(0, 10),
        check_in_date: null,
        check_out_date: null,
        discount_amount: discount,
        cleaning_fee: cleaning,
        guest_paid_after_discount: result.guestPaidAfterDiscount,
        gross_before_discount: result.grossBeforeDiscount,
        platform_commission_rate: platformRate / 100,
        platform_commission_amount: result.platformCommissionAmount,
        bank_fee_rate: platform === "booking" ? bankRate / 100 : 0,
        bank_fee_amount: result.bankFeeAmount,
        manager_rate: managerRate / 100,
        manager_commission_amount: result.managerCommissionAmount,
        manager_cleaning_amount: result.managerCleaningAmount,
        payout_received: result.payoutReceived,
        amount_payable_to_manager: result.amountPayableToManager,
        owner_net_after_manager: result.ownerNetAfterManager,
        calculation_status: Math.abs(result.reconciliationDifference) <= 0.02 ? "reconciled" : "needs_review",
      });
      setMessage("Reserva guardada con su desglose.");
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "No se pudo guardar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page">
      <PageHeader eyebrow="Alquiler turístico" title="Calculadora de reservas" description="Reconstruye el desglose a partir del ingreso bancario. Todas las tasas son editables y la conciliación se muestra antes de guardar." />
      <div className="direction-toggle" style={{ maxWidth: 360, marginBottom: 18 }}>
        <button type="button" className={platform === "airbnb" ? "active" : ""} onClick={() => choosePlatform("airbnb")}>Airbnb</button>
        <button type="button" className={platform === "booking" ? "active" : ""} onClick={() => choosePlatform("booking")}>Booking</button>
      </div>
      <section className="grid two-column">
        <article className="card">
          <div className="card-header"><div><h2><Calculator size={16} style={{ display: "inline", marginRight: 7 }} />Datos de la reserva</h2><p>Importes recibidos y parámetros configurables</p></div></div>
          <div className="card-body form-grid">
            <NumberField label="Ingreso bancario recibido (€)" value={payout} onChange={setPayout} />
            <NumberField label="Descuento (€)" value={discount} onChange={setDiscount} />
            <NumberField label="Limpieza (€)" value={cleaning} onChange={setCleaning} />
            <NumberField label="Comisión gestora (%)" value={managerRate} onChange={setManagerRate} step="0.001" />
            <NumberField label={`Comisión ${platform === "airbnb" ? "efectiva Airbnb" : "Booking"} (%)`} value={platformRate} onChange={setPlatformRate} step="0.001" />
            {platform === "booking" ? <NumberField label="Cargo bancario (%)" value={bankRate} onChange={setBankRate} step="0.001" /> : null}
          </div>
        </article>
        <article className="card">
          <div className="card-header"><div><h2>Conciliación</h2><p>Precisión interna y redondeo visual a céntimos</p></div></div>
          <div className="card-body calculator-results">
            <div className="result-row"><span>Huésped paga tras descuento</span><strong>{formatCurrency(result.guestPaidAfterDiscount)}</strong></div>
            <div className="result-row"><span>Total antes del descuento</span><strong>{formatCurrency(result.grossBeforeDiscount)}</strong></div>
            <div className="result-row"><span>Comisión de plataforma</span><strong>{formatCurrency(result.platformCommissionAmount)}</strong></div>
            {platform === "booking" ? <div className="result-row"><span>Cargo bancario</span><strong>{formatCurrency(result.bankFeeAmount)}</strong></div> : null}
            <div className="result-row"><span>Base de la gestora</span><strong>{formatCurrency(result.managementBase)}</strong></div>
            <div className="result-row"><span>Comisión de la gestora</span><strong>{formatCurrency(result.managerCommissionAmount)}</strong></div>
            <div className="result-row"><span>{platform === "airbnb" ? "Pago total al cohost" : "Pendiente de pagar a la gestora"}</span><strong>{formatCurrency(result.amountPayableToManager)}</strong></div>
            <div className="result-row total"><span>{platform === "airbnb" ? "Ingreso recibido" : "Neto final del propietario"}</span><strong>{formatCurrency(platform === "airbnb" ? result.payoutReceived : result.ownerNetAfterManager)}</strong></div>
          </div>
          <div className="card-body" style={{ paddingTop: 0 }}>
            <p className={`notice ${Math.abs(result.reconciliationDifference) <= 0.02 ? "success" : "error"}`}>Diferencia de conciliación: {formatCurrency(result.reconciliationDifference)}</p>
            <button className="button primary" onClick={() => void save()} disabled={saving || Math.abs(result.reconciliationDifference) > 0.02}>{saving ? <LoaderCircle className="spin" size={16} /> : <Save size={16} />}Guardar reserva</button>
            {message ? <p className="notice">{message}</p> : null}
          </div>
        </article>
      </section>
      <div style={{ height: 18 }} />
      <article className="card">
        <div className="card-header"><div><h2>Reservas guardadas</h2><p>{bookings.length} registros con desglose</p></div></div>
        <div className="card-body">
          {bookings.length ? <div className="calculator-results">{bookings.map((item) => <div className="result-row" key={item.id}><span><span className="badge">{item.platform}</span> {item.booking_date ?? "Sin fecha"}</span><strong>{formatCurrency(item.owner_net_after_manager)}</strong></div>)}</div> : <p className="notice">Aún no hay reservas nuevas. El histórico bancario no se ha desglosado de forma ficticia.</p>}
        </div>
      </article>
    </div>
  );
}
