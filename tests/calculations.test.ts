import { describe, expect, it } from "vitest";
import { calculateAirbnb, calculateBooking, calculateDepreciation } from "@/lib/calculations";

describe("rental calculators", () => {
  it("reconstructs the Airbnb example within two cents", () => {
    const result = calculateAirbnb({
      payoutReceived: 883.55,
      discountAmount: 148.9,
      cleaningFee: 60,
      managerRate: 0.18,
      platformRate: 0.155 * 1.21,
    });

    expect(result.guestPaidAfterDiscount).toBeCloseTo(1400.1, 1);
    expect(result.platformCommissionAmount).toBeCloseTo(262.59, 1);
    expect(result.managerCommissionAmount).toBeCloseTo(193.95, 1);
    expect(result.amountPayableToManager).toBeCloseTo(253.95, 1);
    expect(result.payoutReceived).toBe(883.55);
    expect(Math.abs(result.reconciliationDifference)).toBeLessThanOrEqual(0.02);
  });

  it("reconstructs the Booking example within two cents", () => {
    const result = calculateBooking({
      payoutReceived: 274.03,
      cleaningFee: 70,
      platformRate: 0.15,
      bankRate: 0.013,
      managerRate: 0.18,
    });

    expect(result.guestPaidAfterDiscount).toBeCloseTo(327.4, 1);
    expect(result.platformCommissionAmount).toBeCloseTo(49.11, 1);
    expect(result.bankFeeAmount).toBeCloseTo(4.26, 1);
    expect(result.managerCommissionAmount).toBeCloseTo(36.73, 1);
    expect(result.amountPayableToManager).toBeCloseTo(106.73, 1);
    expect(result.ownerNetAfterManager).toBeCloseTo(167.3, 1);
  });
});

describe("depreciation calculator", () => {
  it("prorates the first natural year by days and never exceeds the basis", () => {
    const result = calculateDepreciation({ cost: 1000, annualRate: 0.1, startDate: "2026-07-01", years: 20 });
    expect(result[0].fiscalYear).toBe(2026);
    expect(result[0].annualDepreciation).toBeCloseTo(50.41, 2);
    expect(result.at(-1)?.pendingValue).toBe(0);
  });
});
