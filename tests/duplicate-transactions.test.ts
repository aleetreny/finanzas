import { describe, expect, it } from "vitest";
import {
  DUPLICATE_LOOKBACK,
  findDuplicateExpense,
  recentExpenses,
} from "../src/lib/duplicate-transactions";
import type { Transaction } from "../src/lib/types";

function movement(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: "tx-1",
    user_id: "user-1",
    account_id: "account-1",
    transaction_date: "2026-08-07",
    allocation_start_date: null,
    allocation_end_date: null,
    name: "Compra del súper",
    amount: -42.5,
    direction: "expense",
    category_id: "cat-food",
    subcategory_id: "sub-market",
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

// Un histórico corto y desordenado: el orden de alta no coincide con el de
// fecha, igual que cuando se anota un ticket de hace una semana.
function history(count: number, overrides: (index: number) => Partial<Transaction> = () => ({})) {
  return Array.from({ length: count }, (_, index) => movement({
    id: `tx-${index}`,
    name: `Gasto ${index}`,
    amount: -(index + 1),
    created_at: `2026-08-${String(index + 1).padStart(2, "0")}T09:00:00Z`,
    ...overrides(index),
  }));
}

const candidate = { amount: 42.5, category_id: "cat-food", subcategory_id: "sub-market" };

describe("recentExpenses", () => {
  it("orders by entry time and keeps only expenses", () => {
    const rows = [
      movement({ id: "old", created_at: "2026-08-01T09:00:00Z" }),
      movement({ id: "income", direction: "income", amount: 900, created_at: "2026-08-09T09:00:00Z" }),
      movement({ id: "new", created_at: "2026-08-05T09:00:00Z" }),
    ];
    expect(recentExpenses(rows).map((row) => row.id)).toEqual(["new", "old"]);
  });

  it("keeps a stable order when several rows share created_at", () => {
    const rows = [
      movement({ id: "b", transaction_date: "2026-07-01", created_at: "2026-08-01T09:00:00Z" }),
      movement({ id: "a", transaction_date: "2026-07-04", created_at: "2026-08-01T09:00:00Z" }),
      movement({ id: "c", transaction_date: "2026-07-04", created_at: "2026-08-01T09:00:00Z" }),
    ];
    expect(recentExpenses(rows).map((row) => row.id)).toEqual(["c", "a", "b"]);
  });

  it("does not mutate the received list", () => {
    const rows = [
      movement({ id: "old", created_at: "2026-08-01T09:00:00Z" }),
      movement({ id: "new", created_at: "2026-08-05T09:00:00Z" }),
    ];
    recentExpenses(rows);
    expect(rows.map((row) => row.id)).toEqual(["old", "new"]);
  });

  it("reviews ten expenses by default", () => {
    expect(DUPLICATE_LOOKBACK).toBe(10);
    expect(recentExpenses(history(25))).toHaveLength(10);
  });
});

describe("findDuplicateExpense", () => {
  it("points at the matching expense when amount and categories repeat", () => {
    const match = findDuplicateExpense(candidate, [movement({ id: "tx-super" })]);
    expect(match?.id).toBe("tx-super");
  });

  it("ignores the sign of the amount", () => {
    expect(findDuplicateExpense({ ...candidate, amount: -42.5 }, [movement()])).not.toBeNull();
  });

  it("returns the most recently entered match", () => {
    const rows = [
      movement({ id: "older", created_at: "2026-08-01T09:00:00Z" }),
      movement({ id: "newer", created_at: "2026-08-06T09:00:00Z" }),
    ];
    expect(findDuplicateExpense(candidate, rows)?.id).toBe("newer");
  });

  it("does not warn about an expense entered before the last ten", () => {
    const rows = [
      ...history(DUPLICATE_LOOKBACK, (index) => ({ created_at: `2026-09-${String(index + 1).padStart(2, "0")}T09:00:00Z` })),
      movement({ id: "eleventh", created_at: "2026-08-01T09:00:00Z" }),
    ];
    expect(findDuplicateExpense(candidate, rows)).toBeNull();
    expect(findDuplicateExpense(candidate, rows, { limit: 11 })?.id).toBe("eleventh");
  });

  it("does not warn for a different amount, category or subcategory", () => {
    expect(findDuplicateExpense({ ...candidate, amount: 42.51 }, [movement()])).toBeNull();
    expect(findDuplicateExpense({ ...candidate, category_id: "cat-home" }, [movement()])).toBeNull();
    expect(findDuplicateExpense({ ...candidate, subcategory_id: "sub-other" }, [movement()])).toBeNull();
  });

  it("accepts cent rounding differences", () => {
    expect(findDuplicateExpense({ ...candidate, amount: 42.5 + 1e-9 }, [movement()])).not.toBeNull();
  });

  it("compares only the category when either entry has no subcategory", () => {
    expect(findDuplicateExpense({ ...candidate, subcategory_id: null }, [movement()])?.id).toBe("tx-1");
    expect(findDuplicateExpense(candidate, [movement({ subcategory_id: null })])?.id).toBe("tx-1");
  });

  it("never matches incomes or uncategorised entries", () => {
    expect(findDuplicateExpense(candidate, [movement({ direction: "income", amount: 42.5 })])).toBeNull();
    expect(findDuplicateExpense({ ...candidate, category_id: null }, [movement({ category_id: null })])).toBeNull();
  });

  it("ignores an empty amount", () => {
    expect(findDuplicateExpense({ ...candidate, amount: 0 }, [movement({ amount: 0 })])).toBeNull();
    expect(findDuplicateExpense({ ...candidate, amount: Number.NaN }, [movement()])).toBeNull();
  });

  it("skips the entry being edited", () => {
    expect(findDuplicateExpense(candidate, [movement({ id: "tx-1" })], { excludeId: "tx-1" })).toBeNull();
  });
});
