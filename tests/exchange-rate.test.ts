import { afterEach, describe, expect, it, vi } from "vitest";
import { convertGbpToEur, fetchGbpEurRate } from "../src/lib/exchange-rate";

afterEach(() => vi.unstubAllGlobals());

describe("GBP to EUR", () => {
  it("multiplies pounds by the GBP/EUR rate and rounds to cents", () => {
    expect(convertGbpToEur(12.34, 1.1622)).toBe(14.34);
    expect(convertGbpToEur(10, 1.15)).toBe(11.5);
  });

  it("rejects missing, invalid and unrepresentable amounts or rates", () => {
    for (const [amount, rate] of [[0, 1.2], [-1, 1.2], [NaN, 1.2], [10, 0], [10, Infinity], [0.001, 1.2], [1e12, 1.2]]) {
      expect(() => convertGbpToEur(amount, rate)).toThrow();
    }
  });

  it("requests only the pair and date, accepts the previous business day", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ date: "2026-09-25", base: "GBP", quote: "EUR", rate: 1.1622 })));
    vi.stubGlobal("fetch", fetchMock);
    const signal = new AbortController().signal;
    expect(await fetchGbpEurRate("2026-09-27", signal)).toEqual({ date: "2026-09-25", base: "GBP", quote: "EUR", rate: 1.1622 });
    expect(fetchMock).toHaveBeenCalledWith("https://api.frankfurter.dev/v2/rate/GBP/EUR?providers=ecb&date=2026-09-27", { signal });
  });

  it("rejects failed responses, the inverse pair, missing rates and future rates", async () => {
    for (const response of [
      new Response("Unavailable", { status: 503 }),
      new Response(JSON.stringify({ date: "2026-09-25", base: "EUR", quote: "GBP", rate: 0.86 })),
      new Response(JSON.stringify({ date: "2026-09-25", base: "GBP", quote: "EUR", rate: null })),
      new Response(JSON.stringify({ date: "2026-09-28", base: "GBP", quote: "EUR", rate: 1.16 })),
    ]) {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response));
      await expect(fetchGbpEurRate("2026-09-27", new AbortController().signal)).rejects.toThrow();
    }
  });
});
