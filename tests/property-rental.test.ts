import { describe, expect, it } from "vitest";
import {
  allocateRentalBooking,
  calculateRentalBooking,
  RENTAL_COMMISSION_PROFILES,
  recurringOccurrencesForYear,
  rentalNights,
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
    platform: "airbnb",
    commission_model: "airbnb_shared_legacy",
    accommodation_final: 390,
    cleaning_fee: 10,
    gross_before_discount: 400,
    discount_amount: 40,
    platform_commission_rate: 0.0363,
    platform_commission_amount: 20,
    platform_commission_override_amount: null,
    manager_rate: 0.18,
    manager_commission_amount: 30,
    manager_cleaning_amount: 10,
    manager_payment_override_amount: null,
    amount_payable_to_manager: 40,
    owner_net_after_manager: 340,
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
    expect(rows.map((row) => row.grossIncome)).toEqual([266.67, 133.33]);
    expect(rows.reduce((sum, row) => sum + row.net, 0)).toBe(340);
    expect(rows.reduce((sum, row) => sum + row.discounts, 0)).toBe(40);
  });

  it("spreads the 7,200 euro long-term rent evenly across six months", () => {
    const rows = allocateRentalBooking(booking({
      check_in_date: "2026-01-01",
      check_out_date: "2026-07-01",
      platform: "direct",
      commission_model: "direct",
      accommodation_final: 7200,
      cleaning_fee: 0,
      gross_before_discount: 7200,
      discount_amount: 0,
      platform_commission_rate: 0,
      platform_commission_amount: 0,
      manager_rate: 0,
      manager_commission_amount: 0,
      manager_cleaning_amount: 0,
      amount_payable_to_manager: 0,
      owner_net_after_manager: 7200,
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

describe("rental commission models", () => {
  const base = {
    checkInDate: "2026-07-30",
    checkOutDate: "2026-08-02",
    accommodationFinal: 1000,
    cleaning: 100,
    managerRate: 0.18,
  };

  it("counts checkout as an exclusive date", () => {
    expect(rentalNights(base.checkInDate, base.checkOutDate)).toBe(3);
  });

  it.each([
    ["airbnb_shared_legacy", 39.93, 787.26],
    ["airbnb_host_only", 206.31, 650.83],
    ["booking_standard", 199.65, 656.29],
    ["direct", 0, 820],
  ] as const)("calculates the %s profile", (model, expectedPlatform, expectedNet) => {
    const calculation = calculateRentalBooking({
      ...base,
      platformRate: RENTAL_COMMISSION_PROFILES[model].platformRate,
    });

    expect(calculation.totalGross).toBe(1100);
    expect(calculation.platformCommissionCalculated).toBe(expectedPlatform);
    expect(calculation.ownerNet).toBe(expectedNet);
  });

  it("applies 21% VAT to Booking's 15% commission", () => {
    expect(RENTAL_COMMISSION_PROFILES.booking_standard.platformRate).toBeCloseTo(0.1815, 10);
  });

  it("uses real platform and cohost payments as exact overrides", () => {
    const calculation = calculateRentalBooking({
      ...base,
      platformRate: RENTAL_COMMISSION_PROFILES.airbnb_host_only.platformRate,
      platformCommissionOverride: 206.32,
      managerPaymentOverride: 242.85,
    });

    expect(calculation.platformCommissionCalculated).toBe(206.31);
    expect(calculation.platformCommissionUsed).toBe(206.32);
    expect(calculation.managerPaymentUsed).toBe(242.85);
    expect(calculation.ownerNet).toBe(650.83);
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
      subcategory_id: "sub-community",
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
