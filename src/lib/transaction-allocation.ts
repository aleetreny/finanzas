import type { Transaction } from "@/lib/types";

const DAY_MS = 86_400_000;

export type TransactionMonthAllocation = {
  month: string;
  amount: number;
  days: number;
};

type AllocatableTransaction = Pick<
  Transaction,
  "transaction_date" | "amount" | "allocation_start_date" | "allocation_end_date"
>;

function parseIsoDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function startOfMonth(value: Date) {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), 1));
}

function endOfMonth(value: Date) {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth() + 1, 0));
}

function addMonth(value: Date) {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth() + 1, 1));
}

function monthKey(value: Date) {
  return `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, "0")}`;
}

function fallbackAllocation(transaction: AllocatableTransaction): TransactionMonthAllocation[] {
  return [{
    month: transaction.transaction_date.slice(0, 7),
    amount: Number(transaction.amount),
    days: 0,
  }];
}

export function hasTransactionAllocationPeriod(transaction: AllocatableTransaction) {
  return Boolean(transaction.allocation_start_date && transaction.allocation_end_date);
}

export function allocateTransactionByMonth(transaction: AllocatableTransaction): TransactionMonthAllocation[] {
  const startText = transaction.allocation_start_date;
  const endText = transaction.allocation_end_date;
  if (!startText || !endText) return fallbackAllocation(transaction);

  const start = parseIsoDate(startText);
  const end = parseIsoDate(endText);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) {
    return fallbackAllocation(transaction);
  }

  const months: { month: string; days: number }[] = [];
  for (let cursor = startOfMonth(start); cursor <= end; cursor = addMonth(cursor)) {
    const overlapStart = start > cursor ? start : cursor;
    const monthEnd = endOfMonth(cursor);
    const overlapEnd = end < monthEnd ? end : monthEnd;
    const days = Math.floor((overlapEnd.getTime() - overlapStart.getTime()) / DAY_MS) + 1;
    if (days > 0) months.push({ month: monthKey(cursor), days });
  }

  const totalDays = months.reduce((sum, item) => sum + item.days, 0);
  if (!totalDays) return fallbackAllocation(transaction);

  const totalCents = Math.round(Number(transaction.amount) * 100);
  let cumulativeDays = 0;
  let allocatedCents = 0;

  return months.map((item, index) => {
    cumulativeDays += item.days;
    const cumulativeCents = index === months.length - 1
      ? totalCents
      : Math.round((totalCents * cumulativeDays) / totalDays);
    const cents = cumulativeCents - allocatedCents;
    allocatedCents = cumulativeCents;
    return { ...item, amount: cents / 100 };
  });
}
