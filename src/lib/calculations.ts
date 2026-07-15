import { roundMoney } from "@/lib/format";

export type AirbnbInput = {
  payoutReceived: number;
  discountAmount?: number;
  cleaningFee?: number;
  managerRate?: number;
  platformRate?: number;
};

export type BookingInput = {
  payoutReceived: number;
  discountAmount?: number;
  cleaningFee?: number;
  managerRate?: number;
  platformRate?: number;
  bankRate?: number;
};

export function calculateAirbnb({
  payoutReceived,
  discountAmount = 0,
  cleaningFee = 60,
  managerRate = 0.18,
  platformRate = 0.155 * 1.21,
}: AirbnbInput) {
  const guestPaidAfterDiscount =
    (payoutReceived / (1 - managerRate) + cleaningFee) /
    (1 - platformRate);
  const grossBeforeDiscount = guestPaidAfterDiscount + discountAmount;
  const platformCommissionAmount = guestPaidAfterDiscount * platformRate;
  const managementBase =
    guestPaidAfterDiscount - platformCommissionAmount - cleaningFee;
  const managerCommissionAmount = managerRate * managementBase;
  const amountPayableToManager = cleaningFee + managerCommissionAmount;
  const reconstructedPayout =
    guestPaidAfterDiscount -
    platformCommissionAmount -
    cleaningFee -
    managerCommissionAmount;

  return {
    guestPaidAfterDiscount: roundMoney(guestPaidAfterDiscount),
    grossBeforeDiscount: roundMoney(grossBeforeDiscount),
    platformCommissionAmount: roundMoney(platformCommissionAmount),
    bankFeeAmount: 0,
    managementBase: roundMoney(managementBase),
    managerCommissionAmount: roundMoney(managerCommissionAmount),
    managerCleaningAmount: roundMoney(cleaningFee),
    amountPayableToManager: roundMoney(amountPayableToManager),
    payoutReceived: roundMoney(payoutReceived),
    ownerNetAfterManager: roundMoney(payoutReceived),
    reconciliationDifference: roundMoney(reconstructedPayout - payoutReceived),
  };
}

export function calculateBooking({
  payoutReceived,
  discountAmount = 0,
  cleaningFee = 70,
  managerRate = 0.18,
  platformRate = 0.15,
  bankRate = 0.013,
}: BookingInput) {
  const guestPaidAfterDiscount =
    payoutReceived / (1 - platformRate - bankRate);
  const grossBeforeDiscount = guestPaidAfterDiscount + discountAmount;
  const platformCommissionAmount = guestPaidAfterDiscount * platformRate;
  const bankFeeAmount = guestPaidAfterDiscount * bankRate;
  const managementBase =
    guestPaidAfterDiscount -
    platformCommissionAmount -
    bankFeeAmount -
    cleaningFee;
  const managerCommissionAmount = managerRate * managementBase;
  const amountPayableToManager = cleaningFee + managerCommissionAmount;
  const ownerNetAfterManager = payoutReceived - amountPayableToManager;

  return {
    guestPaidAfterDiscount: roundMoney(guestPaidAfterDiscount),
    grossBeforeDiscount: roundMoney(grossBeforeDiscount),
    platformCommissionAmount: roundMoney(platformCommissionAmount),
    bankFeeAmount: roundMoney(bankFeeAmount),
    managementBase: roundMoney(managementBase),
    managerCommissionAmount: roundMoney(managerCommissionAmount),
    managerCleaningAmount: roundMoney(cleaningFee),
    amountPayableToManager: roundMoney(amountPayableToManager),
    payoutReceived: roundMoney(payoutReceived),
    ownerNetAfterManager: roundMoney(ownerNetAfterManager),
    reconciliationDifference: 0,
  };
}

export type DepreciationInput = {
  cost: number;
  residualValue?: number;
  annualRate: number;
  businessUsePercentage?: number;
  startDate: string;
  years?: number;
};

export function calculateDepreciation({
  cost,
  residualValue = 0,
  annualRate,
  businessUsePercentage = 1,
  startDate,
  years = 10,
}: DepreciationInput) {
  const start = new Date(`${startDate}T00:00:00Z`);
  const depreciableBasis = Math.max(0, cost - residualValue) * businessUsePercentage;
  const fullYearAmount = depreciableBasis * annualRate;
  let accumulated = 0;

  return Array.from({ length: years }, (_, offset) => {
    const fiscalYear = start.getUTCFullYear() + offset;
    const yearStart = new Date(Date.UTC(fiscalYear, 0, 1));
    const yearEnd = new Date(Date.UTC(fiscalYear + 1, 0, 1));
    const activeStart = offset === 0 ? start : yearStart;
    const activeDays = Math.max(
      0,
      Math.round((yearEnd.getTime() - activeStart.getTime()) / 86_400_000),
    );
    const yearDays = Math.round(
      (yearEnd.getTime() - yearStart.getTime()) / 86_400_000,
    );
    const openingBasis = Math.max(0, depreciableBasis - accumulated);
    const annualDepreciation = Math.min(
      openingBasis,
      fullYearAmount * (activeDays / yearDays),
    );
    accumulated += annualDepreciation;

    return {
      fiscalYear,
      openingBasis: roundMoney(openingBasis),
      annualDepreciation: roundMoney(annualDepreciation),
      accumulatedDepreciation: roundMoney(accumulated),
      pendingValue: roundMoney(Math.max(0, depreciableBasis - accumulated)),
    };
  }).filter((entry) => entry.annualDepreciation > 0);
}
