import { describe, expect, it } from "vitest";
import {
  allocateRentalBooking,
  recurringOccurrencesForYear,
} from "../src/lib/property-rental";
import type { RecurringRule, RentalBooking } from "../src/lib/types";

function booking(overrides: Partial<RentalBooking> = {}): RentalBooking {
  return {
    id: "booking-1",
    user_id: "user-1",
    property_id: "property-1",
    name: "Alquiler",
    check_in_date: "2026-07-30",
    check_out_date: "2026-08-02",
    gross_before_discount: 400,
    discount_amount: 40,
    platform_commission_amount: 20,
    manager_commission_amount: 30,
    manager_cleaning_amount: 10,
    calculation_status: "reconciled",
    allocation_method: "daily",
    source_key: null,
    linked_transaction_id: null,
    notes: null,
    created_at: "2026-07-19T00:00:00Z",
    ...overrides,
  };
}

describe("property rental allocation", () => {
  it("distributes every booking amount by occupied days and preserves totals", () => {
    const rows = allocateRentalBooking(booking());

    expect(rows).toHaveLength(2);
    expect(rows.map((row) => row.month)).toEqual(["2026-07", "2026-08"]);
    expect(rows.map((row) => row.grossIncome)).toEqual([200, 200]);
    expect(rows.reduce((sum, row) => sum + row.net, 0)).toBe(300);
  });

  it("spreads the 7,200 euro long-term rent evenly across six months", () => {
    const rows = allocateRentalBooking(booking({
      check_in_date: "2026-01-01",
      check_out_date: "2026-06-30",
      gross_before_discount: 7200,
      discount_amount: 0,
      platform_commission_amount: 0,
      manager_commission_amount: 0,
      manager_cleaning_amount: 0,
      allocation_method: "monthly",
    }));

    expect(rows).toHaveLength(6);
    expect(rows.every((row) => row.grossIncome === 1200 && row.net === 1200)).toBe(true);
  });

  it("keeps every cent when a value cannot divide evenly", () => {
    const rows = allocateRentalBooking(booking({ gross_before_discount: 100.01 }));
    expect(rows.reduce((sum, row) => sum + Math.round(row.grossIncome * 100), 0)).toBe(10_001);
  });
});

describe("property recurring expenses", () => {
  it("shows monthly rules only after their effective date and up to today", () => {
    const rule: RecurringRule = {
      id: "rule-1",
      name: "Comunidad",
      amount: -70.8,
      frequency: "monthly",
      day_of_month: 1,
      effective_from: "2026-08-01",
      effective_until: null,
      category_id: "property-category",
      subcategory_id: "community",
      context: "Piso Málaga",
      auto_generate: true,
      is_active: true,
      notes: null,
    };

    expect(recurringOccurrencesForYear(rule, 2026, "2026-07-19")).toEqual([]);
    expect(recurringOccurrencesForYear(rule, 2026, "2026-10-15").map((item) => item.date)).toEqual([
      "2026-08-01",
      "2026-09-01",
      "2026-10-01",
    ]);
  });
});
