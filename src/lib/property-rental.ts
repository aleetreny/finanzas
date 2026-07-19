import { roundMoney } from "@/lib/format";
import type { RecurringRule, RentalBooking } from "@/lib/types";

const DAY_MS = 86_400_000;

export type RentalMonthAllocation = {
  month: string;
  grossIncome: number;
  discounts: number;
  platformCommission: number;
  managerCommission: number;
  cleaning: number;
  net: number;
};

export type RecurringOccurrence = {
  ruleId: string;
  name: string;
  date: string;
  month: string;
  amount: number;
  subcategoryId: string | null;
};

function parseIsoDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function isoDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

function monthKeyFromDate(value: Date) {
  return value.toISOString().slice(0, 7);
}

function startOfMonth(value: Date) {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), 1));
}

function endOfMonth(value: Date) {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth() + 1, 0));
}

function addUtcDays(value: Date, days: number) {
  return new Date(value.getTime() + days * DAY_MS);
}

function enumerateMonths(start: Date, end: Date) {
  const result: Date[] = [];
  let cursor = startOfMonth(start);
  const last = startOfMonth(end);
  while (cursor <= last) {
    result.push(cursor);
    cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1));
  }
  return result;
}

function splitMoney(amount: number, weights: number[]) {
  const totalWeight = weights.reduce((total, weight) => total + weight, 0);
  const totalCents = Math.round(amount * 100);
  if (!totalWeight || !totalCents) return weights.map(() => 0);

  let cumulativeWeight = 0;
  let allocatedCents = 0;
  return weights.map((weight, index) => {
    cumulativeWeight += weight;
    const cumulativeCents = index === weights.length - 1
      ? totalCents
      : Math.round((totalCents * cumulativeWeight) / totalWeight);
    const cents = cumulativeCents - allocatedCents;
    allocatedCents = cumulativeCents;
    return cents / 100;
  });
}

export function allocateRentalBooking(booking: RentalBooking): RentalMonthAllocation[] {
  const start = parseIsoDate(booking.check_in_date);
  const end = parseIsoDate(booking.check_out_date);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return [];

  const months = enumerateMonths(start, end);
  const weights = months.map((month) => {
    if (booking.allocation_method === "monthly") return 1;
    const overlapStart = start > month ? start : month;
    const monthEnd = endOfMonth(month);
    const overlapEnd = end < monthEnd ? end : monthEnd;
    return Math.floor((overlapEnd.getTime() - overlapStart.getTime()) / DAY_MS) + 1;
  });

  const gross = splitMoney(Number(booking.gross_before_discount), weights);
  const discounts = splitMoney(Number(booking.discount_amount), weights);
  const platform = splitMoney(Number(booking.platform_commission_amount), weights);
  const manager = splitMoney(Number(booking.manager_commission_amount), weights);
  const cleaning = splitMoney(Number(booking.manager_cleaning_amount), weights);

  return months.map((month, index) => ({
    month: monthKeyFromDate(month),
    grossIncome: gross[index],
    discounts: discounts[index],
    platformCommission: platform[index],
    managerCommission: manager[index],
    cleaning: cleaning[index],
    net: roundMoney(gross[index] - discounts[index] - platform[index] - manager[index] - cleaning[index]),
  }));
}

function minDate(...dates: Date[]) {
  return new Date(Math.min(...dates.map((date) => date.getTime())));
}

function anchoredMonthDate(start: Date, monthOffset: number, dayOfMonth: number) {
  const first = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + monthOffset, 1));
  const lastDay = endOfMonth(first).getUTCDate();
  return new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth(), Math.min(dayOfMonth, lastDay)));
}

export function recurringOccurrencesForYear(
  rule: RecurringRule,
  year: number,
  asOfIso: string,
): RecurringOccurrence[] {
  if (!rule.is_active) return [];
  const effectiveStart = parseIsoDate(rule.effective_from);
  const yearStart = new Date(Date.UTC(year, 0, 1));
  const yearEnd = new Date(Date.UTC(year, 11, 31));
  const asOf = parseIsoDate(asOfIso);
  if (year > asOf.getUTCFullYear()) return [];

  const effectiveEnd = rule.effective_until ? parseIsoDate(rule.effective_until) : yearEnd;
  const visibleEnd = minDate(effectiveEnd, yearEnd, asOf);
  if (effectiveStart > visibleEnd) return [];

  const occurrences: RecurringOccurrence[] = [];
  const addOccurrence = (date: Date) => {
    if (date < yearStart || date > visibleEnd) return;
    const dateIso = isoDate(date);
    occurrences.push({
      ruleId: rule.id,
      name: rule.name,
      date: dateIso,
      month: dateIso.slice(0, 7),
      amount: Math.abs(Number(rule.amount)),
      subcategoryId: rule.subcategory_id,
    });
  };

  if (rule.frequency === "weekly") {
    for (let cursor = effectiveStart; cursor <= visibleEnd; cursor = addUtcDays(cursor, 7)) addOccurrence(cursor);
    return occurrences;
  }

  const intervalMonths = rule.frequency === "monthly" ? 1 : rule.frequency === "quarterly" ? 3 : 12;
  const anchorDay = rule.day_of_month ?? effectiveStart.getUTCDate();
  for (let offset = 0; ; offset += intervalMonths) {
    const occurrence = anchoredMonthDate(effectiveStart, offset, anchorDay);
    if (occurrence > visibleEnd) break;
    addOccurrence(occurrence);
  }
  return occurrences;
}

export function rentalBookingNet(booking: RentalBooking) {
  return roundMoney(
    Number(booking.gross_before_discount)
      - Number(booking.discount_amount)
      - Number(booking.platform_commission_amount)
      - Number(booking.manager_commission_amount)
      - Number(booking.manager_cleaning_amount),
  );
}
