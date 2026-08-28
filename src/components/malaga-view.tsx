"use client";

import { CalendarRange, Pencil, Plus, Repeat2, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { AppModal } from "@/components/app-modal";
import { useFinance } from "@/components/finance-provider";
import { PageHeader } from "@/components/page-header";
import { PropertyRecurringForm } from "@/components/property-recurring-form";
import { RentalBookingForm } from "@/components/rental-booking-form";
import { TransactionForm } from "@/components/transaction-form";
import { TransactionList } from "@/components/transaction-list";
import { categoryById, isMalagaTransaction } from "@/lib/finance-scope";
import { formatCurrency, formatDate, roundMoney, todayIso } from "@/lib/format";
import {
  allocateRentalBooking,
  recurringOccurrencesForYear,
  rentalBookingNet,
} from "@/lib/property-rental";
import { allocateTransactionByMonth } from "@/lib/transaction-allocation";
import type { RecurringRule, RentalBooking } from "@/lib/types";

const MONTHS = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

type MonthlyRow = {
  key: string;
  label: string;
  gross: number;
  otherIncome: number;
  discounts: number;
  platform: number;
  managerCommission: number;
  cleaning: number;
  managerPayment: number;
  payoutAdjustments: number;
  recurring: number;
  otherExpenses: number;
  net: number;
};

type TaxRow = { group: "Ingreso" | "Reducción" | "Gasto"; label: string; amount: number };

function blankMonths(year: number): MonthlyRow[] {
  return MONTHS.map((label, index) => ({
    key: `${year}-${String(index + 1).padStart(2, "0")}`,
    label,
    gross: 0,
    otherIncome: 0,
    discounts: 0,
    platform: 0,
    managerCommission: 0,
    cleaning: 0,
    managerPayment: 0,
    payoutAdjustments: 0,
    recurring: 0,
    otherExpenses: 0,
    net: 0,
  }));
}

function frequencyLabel(frequency: RecurringRule["frequency"]) {
  if (frequency === "monthly") return "Mensual";
  if (frequency === "quarterly") return "Trimestral";
  if (frequency === "yearly") return "Anual";
  return "Semanal";
}

export function MalagaView() {
  const {
    transactions,
    categories,
    subcategories,
    bookings,
    recurringRules,
    deleteBooking,
    deletePropertyRecurring,
  } = useFinance();
  const currentYear = new Date().getFullYear();
  const today = todayIso();
  const [year, setYear] = useState(String(currentYear));
  const [bookingOpen, setBookingOpen] = useState(false);
  const [editingBooking, setEditingBooking] = useState<RentalBooking | null>(null);
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [recurringOpen, setRecurringOpen] = useState(false);
  const [editingRecurring, setEditingRecurring] = useState<RecurringRule | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const categoriesById = useMemo(() => categoryById(categories), [categories]);
  const propertyCategoryIds = useMemo(
    () => new Set(categories.filter((category) => category.category_scope === "property").map((category) => category.id)),
    [categories],
  );
  const subcategoryNames = useMemo(
    () => new Map(subcategories.map((subcategory) => [subcategory.id, subcategory.name])),
    [subcategories],
  );
  const propertyTransactions = useMemo(
    () => transactions.filter((transaction) => isMalagaTransaction(transaction, categoriesById)),
    [categoriesById, transactions],
  );
  const linkedTransactionIds = useMemo(
    () => new Set(bookings.flatMap((booking) => booking.linked_transaction_id ? [booking.linked_transaction_id] : [])),
    [bookings],
  );
  const standaloneTransactions = useMemo(
    () => propertyTransactions.filter((transaction) => !linkedTransactionIds.has(transaction.id)),
    [linkedTransactionIds, propertyTransactions],
  );
  const propertyRecurring = useMemo(
    () => recurringRules.filter((rule) => propertyCategoryIds.has(rule.category_id ?? "") || rule.context?.toLocaleLowerCase("es") === "piso málaga"),
    [propertyCategoryIds, recurringRules],
  );
  const years = useMemo(() => {
    const values = new Set<number>([currentYear]);
    standaloneTransactions.forEach((transaction) => {
      allocateTransactionByMonth(transaction).forEach((allocation) => values.add(Number(allocation.month.slice(0, 4))));
    });
    bookings.forEach((booking) => allocateRentalBooking(booking).forEach((row) => values.add(Number(row.month.slice(0, 4)))));
    propertyRecurring.forEach((rule) => values.add(Number(rule.effective_from.slice(0, 4))));
    return [...values].filter(Number.isFinite).sort((a, b) => b - a);
  }, [bookings, currentYear, propertyRecurring, standaloneTransactions]);
  const selectedYear = Number(year);

  const analysis = useMemo(() => {
    const months = blankMonths(selectedYear);
    const byMonth = new Map(months.map((month) => [month.key, month]));
    const expenseGroups = new Map<string, number>();

    bookings.forEach((booking) => {
      allocateRentalBooking(booking).forEach((allocation) => {
        const month = byMonth.get(allocation.month);
        if (!month) return;
        month.gross += allocation.grossIncome;
        month.discounts += allocation.discounts;
        month.platform += allocation.platformCommission;
        month.managerCommission += allocation.managerCommission;
        month.cleaning += allocation.cleaning;
        month.managerPayment += allocation.managerPayment;
        month.payoutAdjustments += allocation.payoutAdjustment;
      });
    });

    const selectedTransactions = standaloneTransactions
      .filter((transaction) => allocateTransactionByMonth(transaction).some((allocation) => allocation.month.startsWith(String(selectedYear))))
      .sort((a, b) => b.transaction_date.localeCompare(a.transaction_date));

    standaloneTransactions.forEach((transaction) => {
      allocateTransactionByMonth(transaction).forEach((allocation) => {
        const month = byMonth.get(allocation.month);
        if (!month) return;
        if (allocation.amount >= 0) {
          month.otherIncome += allocation.amount;
          return;
        }
        const expense = Math.abs(allocation.amount);
        month.otherExpenses += expense;
        const label = subcategoryNames.get(transaction.subcategory_id ?? "") ?? transaction.name;
        expenseGroups.set(label, roundMoney((expenseGroups.get(label) ?? 0) + expense));
      });
    });

    const occurrences = propertyRecurring.flatMap((rule) => recurringOccurrencesForYear(rule, selectedYear, today));
    occurrences.forEach((occurrence) => {
      const month = byMonth.get(occurrence.month);
      if (!month) return;
      month.recurring += occurrence.amount;
      const label = subcategoryNames.get(occurrence.subcategoryId ?? "") ?? occurrence.name;
      expenseGroups.set(label, roundMoney((expenseGroups.get(label) ?? 0) + occurrence.amount));
    });

    months.forEach((month) => {
      month.gross = roundMoney(month.gross);
      month.otherIncome = roundMoney(month.otherIncome);
      month.discounts = roundMoney(month.discounts);
      month.platform = roundMoney(month.platform);
      month.managerCommission = roundMoney(month.managerCommission);
      month.cleaning = roundMoney(month.cleaning);
      month.managerPayment = roundMoney(month.managerPayment);
      month.payoutAdjustments = roundMoney(month.payoutAdjustments);
      month.recurring = roundMoney(month.recurring);
      month.otherExpenses = roundMoney(month.otherExpenses);
      month.net = roundMoney(
        month.gross + month.otherIncome - month.platform - month.managerPayment - month.payoutAdjustments
          - month.recurring - month.otherExpenses,
      );
    });

    const total = (field: keyof Omit<MonthlyRow, "key" | "label">) => roundMoney(months.reduce((sum, month) => sum + month[field], 0));
    const gross = total("gross");
    const otherIncome = total("otherIncome");
    const discounts = total("discounts");
    const platform = total("platform");
    const manager = total("managerCommission");
    const cleaning = total("cleaning");
    const managerPayment = total("managerPayment");
    const payoutAdjustments = total("payoutAdjustments");
    const recurring = total("recurring");
    const otherExpenses = total("otherExpenses");
    const fixedTaxRows: TaxRow[] = [
      { group: "Ingreso", label: "Alquileres brutos", amount: gross },
      { group: "Ingreso", label: "Otros ingresos e indemnizaciones", amount: otherIncome },
      { group: "Reducción", label: "Descuentos", amount: discounts },
      { group: "Gasto", label: "Comisión de plataforma", amount: platform },
      { group: "Gasto", label: "Comisión del gestor", amount: manager },
      { group: "Gasto", label: "Limpieza de reservas", amount: cleaning },
      { group: "Gasto", label: "Gastos o ajustes sobre cobros", amount: payoutAdjustments },
    ];
    const taxRows: TaxRow[] = [
      ...fixedTaxRows,
      ...[...expenseGroups.entries()]
        .sort(([left], [right]) => left.localeCompare(right, "es"))
        .map(([label, amount]) => ({ group: "Gasto" as const, label, amount })),
    ].filter((row) => row.amount !== 0);

    return {
      months,
      selectedTransactions,
      taxRows,
      income: roundMoney(gross + otherIncome),
      expenses: roundMoney(platform + managerPayment + payoutAdjustments + recurring + otherExpenses),
      net: total("net"),
    };
  }, [bookings, propertyRecurring, selectedYear, standaloneTransactions, subcategoryNames, today]);

  const selectedBookings = useMemo(
    () => bookings
      .filter((booking) => allocateRentalBooking(booking).some((allocation) => allocation.month.startsWith(String(selectedYear))))
      .sort((a, b) => b.check_in_date.localeCompare(a.check_in_date)),
    [bookings, selectedYear],
  );
  const pendingBookings = selectedBookings.filter((booking) => booking.calculation_status === "needs_review").length;

  function openNewBooking() {
    setEditingBooking(null);
    setBookingOpen(true);
  }

  function openNewRecurring() {
    setEditingRecurring(null);
    setRecurringOpen(true);
  }

  async function removeBooking(booking: RentalBooking) {
    if (!window.confirm(`¿Eliminar la reserva “${booking.name}”?`)) return;
    setActionError(null);
    try {
      await deleteBooking(booking.id);
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : "No se pudo eliminar la reserva.");
    }
  }

  async function removeRecurring(rule: RecurringRule) {
    if (!window.confirm(`¿Eliminar el gasto periódico “${rule.name}”?`)) return;
    setActionError(null);
    try {
      await deletePropertyRecurring(rule.id);
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : "No se pudo eliminar el gasto periódico.");
    }
  }

  return (
    <div className="page property-page">
      <PageHeader
        eyebrow="Renta del inmueble"
        title="Piso Málaga"
        description="Reservas, gastos y resumen anual preparados para revisar la renta del inmueble."
        action={(
          <div className="property-actions">
            <button className="button primary" onClick={openNewBooking}><CalendarRange size={16} />Nueva reserva</button>
            <button className="button" onClick={() => setExpenseOpen(true)}><Plus size={16} />Nuevo gasto</button>
            <button className="button" onClick={openNewRecurring}><Repeat2 size={16} />Gasto periódico</button>
          </div>
        )}
      />

      <div className="property-year-bar">
        <div>
          <span className="eyebrow">Ejercicio</span>
          <select value={year} onChange={(event) => setYear(event.target.value)} aria-label="Año del resumen del piso">
            {years.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </div>
        <p>{selectedYear === currentYear ? `Acumulado hasta ${formatDate(today)}. Los gastos futuros aún no se incluyen.` : "Totales del año natural completo según los datos registrados."}</p>
      </div>

      {pendingBookings ? (
        <p className="notice rental-review-notice">
          Tienes {pendingBookings} {pendingBookings === 1 ? "cobro de julio pendiente" : "cobros de julio pendientes"} de completar con fechas, descuentos y comisiones.
        </p>
      ) : null}
      {actionError ? <p className="notice error">{actionError}</p> : null}

      <div className="property-summary" aria-label={`Resumen del Piso Málaga en ${selectedYear}`}>
        <div><span>Ingresos registrados</span><strong className="positive">{formatCurrency(analysis.income)}</strong></div>
        <div><span>Gastos computados</span><strong className="negative">{formatCurrency(-analysis.expenses)}</strong></div>
        <div><span>Neto acumulado</span><strong className={analysis.net >= 0 ? "positive" : ""}>{formatCurrency(analysis.net)}</strong></div>
      </div>

      <section className="property-section">
        <div className="section-heading"><div><p className="eyebrow">Evolución</p><h2>Desglose mensual</h2></div><span className="badge">{selectedYear}</span></div>
        <div className="property-table-scroll">
          <table className="data-table property-dashboard-table">
            <thead><tr><th>Mes</th><th>Ingresos brutos</th><th>Descuento / ajuste</th><th>Com. plataforma</th><th>Pago gestora</th><th>Ajuste cobro</th><th>Periódicos</th><th>Otros gastos</th><th>Neto</th></tr></thead>
            <tbody>
              {analysis.months.map((month) => (
                <tr key={month.key}>
                  <td><strong>{month.label}</strong>{month.otherIncome ? <span className="transaction-note">+ {formatCurrency(month.otherIncome)} otros ingresos</span> : null}</td>
                  <MoneyCell value={month.gross} positive />
                  <MoneyCell value={month.discounts} negative />
                  <MoneyCell value={month.platform} negative />
                  <MoneyCell value={month.managerPayment} negative />
                  <MoneyCell value={month.payoutAdjustments} negative />
                  <MoneyCell value={month.recurring} negative />
                  <MoneyCell value={month.otherExpenses} negative />
                  <MoneyCell value={month.net} signed />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="property-section">
        <div className="section-heading"><div><p className="eyebrow">Hacienda</p><h2>Totales del año natural</h2></div><span className="badge">Resumen fiscal</span></div>
        <div className="property-tax-grid">
          {analysis.taxRows.length ? analysis.taxRows.map((row) => (
            <div className="tax-total-row" key={`${row.group}-${row.label}`}>
              <span className={`badge ${row.group === "Ingreso" ? "green" : row.group === "Reducción" ? "gold" : ""}`}>{row.group}</span>
              <strong>{row.label}</strong>
              <span className={`amount ${row.group === "Ingreso" ? "positive" : "negative"}`}>{formatCurrency(row.group === "Ingreso" ? row.amount : -row.amount)}</span>
            </div>
          )) : <p className="empty-inline">Todavía no hay importes para este ejercicio.</p>}
        </div>
        <p className="form-help">Este cuadro ordena los datos registrados; confirma con tu asesor el tratamiento fiscal definitivo de cada partida.</p>
      </section>

      <section className="property-section">
        <div className="section-heading">
          <div><p className="eyebrow">Ingresos</p><h2>Reservas y alquileres</h2></div>
          <button className="button small" onClick={openNewBooking}><Plus size={15} />Añadir</button>
        </div>
        {selectedBookings.length ? (
          <>
            <div className="property-table-scroll booking-table-scroll">
              <table className="data-table property-dashboard-table booking-table">
                <thead><tr><th>Periodo</th><th>Reserva</th><th>Total bruto</th><th>Ajuste</th><th>Com. plataforma</th><th>Pago gestora</th><th>Ajuste cobro</th><th>Neto</th><th aria-label="Acciones" /></tr></thead>
                <tbody>
                  {selectedBookings.map((booking) => (
                    <tr key={booking.id}>
                      <td>{formatDate(booking.check_in_date)}<span className="transaction-note">hasta {formatDate(booking.check_out_date)}</span></td>
                      <td><strong>{booking.name}</strong>{booking.calculation_status === "needs_review" ? <span className="badge gold booking-status">Completar</span> : null}</td>
                      <td className="amount positive">{formatCurrency(Number(booking.gross_before_discount))}</td>
                      <td className="amount negative">{Number(booking.discount_amount) ? formatCurrency(-Number(booking.discount_amount)) : "—"}</td>
                      <td className="amount negative">{Number(booking.platform_commission_amount) ? formatCurrency(-Number(booking.platform_commission_amount)) : "—"}</td>
                      <td className="amount negative">{Number(booking.amount_payable_to_manager) ? formatCurrency(-Number(booking.amount_payable_to_manager)) : "—"}</td>
                      <td className="amount negative">{Number(booking.payout_adjustment_amount) ? formatCurrency(-Number(booking.payout_adjustment_amount)) : "—"}</td>
                      <td className={`amount ${rentalBookingNet(booking) >= 0 ? "positive" : ""}`}>{formatCurrency(rentalBookingNet(booking))}</td>
                      <td><div className="row-actions"><button className="icon-button" title="Editar desglose" onClick={() => { setEditingBooking(booking); setBookingOpen(true); }}><Pencil size={15} /></button><button className="icon-button" title="Eliminar reserva" onClick={() => void removeBooking(booking)}><Trash2 size={15} /></button></div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mobile-booking-list">
              {selectedBookings.map((booking) => (
                <article className="mobile-booking" key={booking.id}>
                  <div className="mobile-booking-head">
                    <div>
                      <strong>{booking.name}</strong>
                      <span>{formatDate(booking.check_in_date)} — {formatDate(booking.check_out_date)}</span>
                    </div>
                    <strong className={`amount ${rentalBookingNet(booking) >= 0 ? "positive" : ""}`}>{formatCurrency(rentalBookingNet(booking))}</strong>
                  </div>
                  <div className="mobile-booking-breakdown">
                    <span>Bruto <strong>{formatCurrency(Number(booking.gross_before_discount))}</strong></span>
                    <span>Plataforma <strong>{formatCurrency(-Number(booking.platform_commission_amount))}</strong></span>
                    <span>Gestora <strong>{formatCurrency(-Number(booking.amount_payable_to_manager))}</strong></span>
                    {Number(booking.payout_adjustment_amount) > 0 ? <span>Ajuste cobro <strong>{formatCurrency(-Number(booking.payout_adjustment_amount))}</strong></span> : null}
                  </div>
                  {booking.calculation_status === "needs_review" ? <span className="badge gold">Completar datos</span> : null}
                  <div className="mobile-booking-actions" role="group" aria-label={`Acciones para ${booking.name}`}>
                    <button className="button small" type="button" onClick={() => { setEditingBooking(booking); setBookingOpen(true); }}><Pencil size={15} />Editar</button>
                    <button className="button small danger" type="button" onClick={() => void removeBooking(booking)}><Trash2 size={15} />Eliminar</button>
                  </div>
                </article>
              ))}
            </div>
          </>
        ) : <p className="empty-inline">No hay reservas registradas para {selectedYear}.</p>}
      </section>

      <section className="property-section">
        <div className="section-heading">
          <div><p className="eyebrow">Automáticos</p><h2>Gastos periódicos</h2></div>
          <button className="button small" onClick={openNewRecurring}><Plus size={15} />Añadir</button>
        </div>
        {propertyRecurring.length ? (
          <div className="recurring-list">
            {propertyRecurring.map((rule) => (
              <div className="recurring-row" key={rule.id}>
                <div><strong>{rule.name}</strong><span>{frequencyLabel(rule.frequency)} · desde {formatDate(rule.effective_from)}{rule.effective_until ? ` hasta ${formatDate(rule.effective_until)}` : ""}</span></div>
                <span className="badge">{subcategoryNames.get(rule.subcategory_id ?? "") ?? "Sin categoría"}</span>
                <strong className="amount">{formatCurrency(Math.abs(Number(rule.amount)))}</strong>
                <div className="row-actions"><button className="icon-button" title="Editar gasto periódico" onClick={() => { setEditingRecurring(rule); setRecurringOpen(true); }}><Pencil size={15} /></button><button className="icon-button" title="Eliminar gasto periódico" onClick={() => void removeRecurring(rule)}><Trash2 size={15} /></button></div>
              </div>
            ))}
          </div>
        ) : <p className="empty-inline">No hay gastos periódicos. Puedes añadir comunidad, seguro u otros pagos.</p>}
      </section>

      <section className="property-section">
        <div className="section-heading">
          <div><p className="eyebrow">Otros apuntes</p><h2>Gastos e ingresos no asociados a reservas</h2></div>
          <button className="button small" onClick={() => setExpenseOpen(true)}><Plus size={15} />Nuevo gasto</button>
        </div>
        <TransactionList transactions={analysis.selectedTransactions} formScope="property" />
      </section>

      {bookingOpen ? (
        <AppModal className="property-modal" title={editingBooking ? "Editar reserva" : "Nueva reserva"} eyebrow="Ingreso del piso" onClose={() => { setBookingOpen(false); setEditingBooking(null); }}>
          <RentalBookingForm initial={editingBooking ?? undefined} onSaved={() => { setBookingOpen(false); setEditingBooking(null); }} onCancel={() => { setBookingOpen(false); setEditingBooking(null); }} />
        </AppModal>
      ) : null}

      {expenseOpen ? (
        <AppModal className="property-modal" title="Nuevo gasto" eyebrow="Piso Málaga" onClose={() => setExpenseOpen(false)}>
          <TransactionForm scope="property" fixedDirection="expense" onSaved={() => setExpenseOpen(false)} onCancel={() => setExpenseOpen(false)} />
        </AppModal>
      ) : null}

      {recurringOpen ? (
        <AppModal className="property-modal" title={editingRecurring ? "Editar gasto periódico" : "Nuevo gasto periódico"} eyebrow="Automático" onClose={() => { setRecurringOpen(false); setEditingRecurring(null); }}>
          <PropertyRecurringForm initial={editingRecurring ?? undefined} onSaved={() => { setRecurringOpen(false); setEditingRecurring(null); }} onCancel={() => { setRecurringOpen(false); setEditingRecurring(null); }} />
        </AppModal>
      ) : null}
    </div>
  );
}

function MoneyCell({ value, positive = false, negative = false, signed = false }: { value: number; positive?: boolean; negative?: boolean; signed?: boolean }) {
  const tone = positive && value > 0 ? "positive" : negative && value > 0 ? "negative" : signed && value > 0 ? "positive" : signed && value < 0 ? "negative" : "";
  return <td className={`amount ${tone}`}>{value ? formatCurrency(negative ? -Math.abs(value) : value) : "—"}</td>;
}
