import { describe, expect, it } from "vitest";
import { categoryById, isMalagaTransaction } from "@/lib/finance-scope";
import type { Category, Transaction } from "@/lib/types";

const categories: Category[] = [
  { id: "personal", name: "Comida", sort_order: 0, is_active: true, category_scope: "expense" },
  { id: "property", name: "Mi inmueble", sort_order: 1, is_active: true, category_scope: "property" },
];

function transaction(overrides: Partial<Transaction>): Transaction {
  return {
    id: "transaction",
    user_id: "user",
    account_id: "account",
    transaction_date: "2026-07-17",
    name: "Apunte",
    amount: -10,
    direction: "expense",
    category_id: "personal",
    subcategory_id: null,
    context: "Personal",
    platform: null,
    trip_project_id: null,
    recurring_rule_id: null,
    fiscal_property_status: null,
    notes: null,
    source: "manual",
    source_external_id: null,
    created_at: "2026-07-17T00:00:00.000Z",
    ...overrides,
  };
}

describe("finance scopes", () => {
  const byId = categoryById(categories);

  it("recognizes the property by semantic category scope after a rename", () => {
    expect(isMalagaTransaction(transaction({ category_id: "property" }), byId)).toBe(true);
  });

  it("keeps legacy property entries separated by context", () => {
    expect(isMalagaTransaction(transaction({ category_id: null, context: "Piso Málaga" }), byId)).toBe(true);
  });

  it("keeps personal entries in the general views", () => {
    expect(isMalagaTransaction(transaction({}), byId)).toBe(false);
  });
});
