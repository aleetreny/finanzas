import { afterEach, describe, expect, it, vi } from "vitest";
import { monthKey, roundMoney, todayIso } from "@/lib/format";

describe("fechas y redondeo", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("todayIso usa la fecha local aunque la conversión a UTC cambie de día", () => {
    vi.useFakeTimers();
    // 00:30 hora local: en husos positivos (España) la fecha UTC aún es el día anterior.
    vi.setSystemTime(new Date(2026, 6, 20, 0, 30));
    expect(todayIso()).toBe("2026-07-20");
  });

  it("roundMoney corrige el error binario típico", () => {
    expect(roundMoney(0.1 + 0.2)).toBe(0.3);
    expect(roundMoney(10.005)).toBe(10.01);
  });

  it("monthKey recorta a año-mes", () => {
    expect(monthKey("2026-07-20")).toBe("2026-07");
  });
});
