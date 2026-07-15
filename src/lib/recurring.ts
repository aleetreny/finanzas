import type { RecurringRule, Transaction } from "@/lib/types";

function monthlyKey(date: string) {
  return date.slice(0, 7);
}

export function pendingMonthlyOccurrences(
  rule: RecurringRule,
  existing: Pick<Transaction, "recurring_rule_id" | "transaction_date">[],
  throughDate: string,
) {
  if (!rule.is_active || rule.frequency !== "monthly" || !rule.day_of_month) {
    return [];
  }

  const from = new Date(`${rule.effective_from}T00:00:00Z`);
  const through = new Date(`${throughDate}T00:00:00Z`);
  const until = rule.effective_until
    ? new Date(`${rule.effective_until}T00:00:00Z`)
    : through;
  const end = until < through ? until : through;
  const existingKeys = new Set(
    existing
      .filter((row) => row.recurring_rule_id === rule.id)
      .map((row) => monthlyKey(row.transaction_date)),
  );
  const occurrences: string[] = [];

  for (
    let cursor = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), 1));
    cursor <= end;
    cursor.setUTCMonth(cursor.getUTCMonth() + 1)
  ) {
    const lastDay = new Date(
      Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 0),
    ).getUTCDate();
    const occurrence = new Date(
      Date.UTC(
        cursor.getUTCFullYear(),
        cursor.getUTCMonth(),
        Math.min(rule.day_of_month, lastDay),
      ),
    );
    const iso = occurrence.toISOString().slice(0, 10);
    if (
      occurrence >= from &&
      occurrence <= end &&
      !existingKeys.has(monthlyKey(iso))
    ) {
      occurrences.push(iso);
    }
  }

  return occurrences;
}
