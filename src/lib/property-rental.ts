import { roundMoney } from "@/lib/format";
import type {
  RecurringRule,
  RentalBooking,
  RentalCommissionModel,
  RentalPlatform,
} from "@/lib/types";

const DAY_MS = 86_400_000;

export type RentalMonthAllocation = {
  month: string;
  grossIncome: number;
  discounts: number;
  platformCommission: number;
  managerCommission: number;
  cleaning: number;
  managerPayment: number;
  net: number;
};

export type RentalCalculationInput = {
  checkInDate: string;
  checkOutDate: string;
  accommodationFinal: number;
  cleaning: number;
  platformRate: number;
  managerRate: number;
  platformCommissionOverride?: number | null;
  managerPaymentOverride?: number | null;
};

export type RentalCalculation = {
  nights: number;
  totalGross: number;
  platformCommissionCalculated: number;
  platformCommissionUsed: number;
  netAfterPlatform: number;
  managerCommissionBase: number;
  managerCommissionCalculated: number;
  managerPaymentCalculated: number;
  managerPaymentUsed: number;
  ownerNet: number;
};

export const RENTAL_COMMISSION_PROFILES: Record<
  RentalCommissionModel,
  { platform: RentalPlatform; platformRate: number; managerRate: number }
> = {
  airbnb_shared_legacy: { platform: "airbnb", platformRate: 0.03 * 1.21, managerRate: 0.18 },
  airbnb_host_only: { platform: "airbnb", platformRate: 0.155 * 1.21, managerRate: 0.18 },
  booking_standard: { platform: "booking", platformRate: 0.15 + 0.013, managerRate: 0.18 },
  direct: { platform: "direct", platformRate: 0, managerRate: 0.18 },
  other: { platform: "other", platformRate: 0, managerRate: 0.18 },
};

export function defaultCommissionModel(platform: RentalPlatform): RentalCommissionModel {
  if (platform === "airbnb") return "airbnb_host_only";
  if (platform === "booking") return "booking_standard";
  if (platform === "direct") return "direct";
  return "other";
}

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

export function rentalNights(checkInDate: string, checkOutDate: string) {
  const start = parseIsoDate(checkInDate);
  const end = parseIsoDate(checkOutDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) return 0;
  return Math.floor((end.getTime() - start.getTime()) / DAY_MS);
}

function hasOverride(value: number | null | undefined): value is number {
  return value !== null && value !== undefined && Number.isFinite(Number(value));
}

export function calculateRentalBooking(input: RentalCalculationInput): RentalCalculation {
  const totalGross = roundMoney(Number(input.accommodationFinal) + Number(input.cleaning));
  const platformCommissionCalculated = roundMoney(totalGross * Number(input.platformRate));
  const platformCommissionUsed = roundMoney(
    hasOverride(input.platformCommissionOverride)
      ? Number(input.platformCommissionOverride)
      : platformCommissionCalculated,
  );
  const netAfterPlatform = roundMoney(totalGross - platformCommissionUsed);
  const managerCommissionBase = roundMoney(netAfterPlatform - Number(input.cleaning));
  const managerCommissionCalculated = roundMoney(managerCommissionBase * Number(input.managerRate));
  const managerPaymentCalculated = roundMoney(Number(input.cleaning) + managerCommissionCalculated);
  const managerPaymentUsed = roundMoney(
    hasOverride(input.managerPaymentOverride)
      ? Number(input.managerPaymentOverride)
      : managerPaymentCalculated,
  );

  return {
    nights: rentalNights(input.checkInDate, input.checkOutDate),
    totalGross,
    platformCommissionCalculated,
    platformCommissionUsed,
    netAfterPlatform,
    managerCommissionBase,
    managerCommissionCalculated,
    managerPaymentCalculated,
    managerPaymentUsed,
    ownerNet: roundMoney(totalGross - platformCommissionUsed - managerPaymentUsed),
  };
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
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) return [];

  const lastNight = addUtcDays(end, -1);
  const months = enumerateMonths(start, lastNight);
  const weights = months.map((month) => {
    if (booking.allocation_method === "monthly") return 1;
    const overlapStart = start > month ? start : month;
    const monthEnd = endOfMonth(month);
    const overlapEnd = lastNight < monthEnd ? lastNight : monthEnd;
    return Math.floor((overlapEnd.getTime() - overlapStart.getTime()) / DAY_MS) + 1;
  });

  const gross = splitMoney(Number(booking.gross_before_discount), weights);
  const discounts = splitMoney(Number(booking.discount_amount), weights);
  const platform = splitMoney(Number(booking.platform_commission_amount), weights);
  const managerPaymentTotal = Number(booking.amount_payable_to_manager);
  const cleaningTotal = Math.min(Number(booking.cleaning_fee), managerPaymentTotal);
  const managerCommissionTotal = managerPaymentTotal - cleaningTotal;
  const manager = splitMoney(managerCommissionTotal, weights);
  const cleaning = splitMoney(cleaningTotal, weights);
  const managerPayment = splitMoney(managerPaymentTotal, weights);

  return months.map((month, index) => ({
    month: monthKeyFromDate(month),
    grossIncome: gross[index],
    discounts: discounts[index],
    platformCommission: platform[index],
    managerCommission: manager[index],
    cleaning: cleaning[index],
    managerPayment: managerPayment[index],
    net: roundMoney(gross[index] - platform[index] - managerPayment[index]),
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
      - Number(booking.platform_commission_amount)
      - Number(booking.amount_payable_to_manager),
  );
}
