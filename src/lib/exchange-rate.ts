import { z } from "zod";
import { roundMoney } from "@/lib/format";

export const EXCHANGE_RATE_URL = "https://api.frankfurter.dev/v2/rate/GBP/EUR?providers=ecb";

const rateSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  base: z.literal("GBP"),
  quote: z.literal("EUR"),
  rate: z.number().positive().finite(),
});

export type ExchangeRate = z.infer<typeof rateSchema>;

export function convertGbpToEur(amount: number, rate: number): number {
  if (!Number.isFinite(amount) || amount <= 0 || !Number.isFinite(rate) || rate <= 0) {
    throw new Error("El importe y el cambio deben ser mayores que cero.");
  }
  const converted = roundMoney(amount * rate);
  if (!Number.isFinite(converted) || converted < 0.01 || converted >= 1e12) {
    throw new Error("El importe convertido debe estar entre 0,01 € y 999.999.999.999,99 €.");
  }
  return converted;
}

export async function fetchGbpEurRate(date: string, signal: AbortSignal): Promise<ExchangeRate> {
  const response = await fetch(`${EXCHANGE_RATE_URL}&date=${encodeURIComponent(date)}`, { signal });
  if (!response.ok) throw new Error("No se pudo consultar el cambio. Vuelve a intentarlo.");
  const result = rateSchema.safeParse(await response.json());
  if (!result.success || result.data.date > date) {
    throw new Error("El servicio devolvió un cambio no válido. Vuelve a intentarlo.");
  }
  return result.data;
}
