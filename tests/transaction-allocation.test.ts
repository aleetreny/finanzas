import { describe, expect, it } from "vitest";
import { allocateTransactionByMonth } from "../src/lib/transaction-allocation";
import type { Transaction } from "../src/lib/types";

function movement(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: "tx-1",
    user_id: "user-1",
    account_id: "account-1",
    transaction_date: "2026-08-07",
    allocation_start_date: null,
    allocation_end_date: null,
    name: "Factura",
    amount: -90,
    direction: "expense",
    category_id: "cat-home",
    subcategory_id: "sub-electricity",
    context: null,
    platform: null,
    trip_project_id: null,
    recurring_rule_id: null,
    fiscal_property_status: null,
    notes: null,
    source: "manual",
    source_external_id: null,
    created_at: "2026-08-07T12:00:00Z",
    ...overrides,
  };
}

describe("allocateTransactionByMonth", () => {
  it("uses the bank transaction month when there is no allocation period", () => {
    expect(allocateTransactionByMonth(movement())).toEqual([
      { month: "2026-08", amount: -90, days: 0 },
    ]);
  });

  it("allocates an electricity bill by occupied calendar days", () => {
    expect(allocateTransactionByMonth(movement({
      allocation_start_date: "2026-06-30",
      allocation_end_date: "2026-07-30",
    }))).toEqual([
      { month: "2026-06", amount: -2.9, days: 1 },
      { month: "2026-07", amount: -87.1, days: 30 },
    ]);
  });

  it("preserves every cent across year boundaries", () => {
    const rows = allocateTransactionByMonth(movement({
      amount: -100.01,
      allocation_start_date: "2026-12-31",
      allocation_end_date: "2027-01-01",
    }));

    expect(rows.map((row) => row.month)).toEqual(["2026-12", "2027-01"]);
    expect(rows.reduce((sum, row) => sum + Math.round(row.amount * 100), 0)).toBe(-10_001);
  });

  it("keeps the full amount when the period stays inside one month", () => {
    expect(allocateTransactionByMonth(movement({
      allocation_start_date: "2026-07-05",
      allocation_end_date: "2026-07-20",
    }))).toEqual([
      { month: "2026-07", amount: -90, days: 16 },
    ]);
  });
});
