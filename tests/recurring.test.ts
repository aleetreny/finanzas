import { describe, expect, it } from "vitest";
import { pendingMonthlyOccurrences } from "@/lib/recurring";
import type { RecurringRule } from "@/lib/types";

const monthlyRule: RecurringRule = {
  id: "monthly-rule",
  name: "Aportación mensual",
  amount: 100,
  frequency: "monthly",
  day_of_month: 1,
  effective_from: "2026-08-01",
  effective_until: null,
  category_id: null,
  subcategory_id: null,
  context: "Personal",
  auto_generate: true,
  is_active: true,
  notes: null,
};

describe("recurring generation", () => {
  it("does not generate occurrences before the effective date", () => {
    expect(pendingMonthlyOccurrences(monthlyRule, [], "2026-07-31")).toEqual([]);
  });

  it("generates one occurrence per month and skips an existing month", () => {
    const existing = [{ recurring_rule_id: monthlyRule.id, transaction_date: "2026-08-01" }];
    expect(pendingMonthlyOccurrences(monthlyRule, existing, "2026-10-31")).toEqual(["2026-09-01", "2026-10-01"]);
  });
});
