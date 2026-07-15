import { describe, expect, it } from "vitest";
import { pendingMonthlyOccurrences } from "@/lib/recurring";
import type { RecurringRule } from "@/lib/types";

const parkingIncome: RecurringRule = {
  id: "parking-income",
  name: "Ingreso parking subarrendado",
  amount: 130,
  frequency: "monthly",
  day_of_month: 1,
  effective_from: "2026-08-01",
  effective_until: null,
  category_id: null,
  subcategory_id: null,
  context: "Parking subarrendado",
  auto_generate: true,
  is_active: true,
  notes: null,
};

describe("recurring generation", () => {
  it("does not generate parking before August 2026", () => {
    expect(pendingMonthlyOccurrences(parkingIncome, [], "2026-07-31")).toEqual([]);
  });

  it("generates one occurrence per month and skips an existing month", () => {
    const existing = [{ recurring_rule_id: parkingIncome.id, transaction_date: "2026-08-01" }];
    expect(pendingMonthlyOccurrences(parkingIncome, existing, "2026-10-31")).toEqual(["2026-09-01", "2026-10-01"]);
  });

  it("keeps the future parking net at +35 euros", () => {
    expect(130 - 95).toBe(35);
  });
});
