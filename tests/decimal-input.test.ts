import { describe, expect, it } from "vitest";
import { parseLocalizedDecimal } from "../src/lib/decimal-input";

describe("parseLocalizedDecimal", () => {
  it.each([
    ["12,34", 12.34],
    ["12.34", 12.34],
    ["1.234,56", 1234.56],
    ["1,234.56", 1234.56],
    [" 95,50 ", 95.5],
  ])("parses %s", (input, expected) => {
    expect(parseLocalizedDecimal(input)).toBe(expected);
  });

  it("keeps finite numeric values", () => {
    expect(parseLocalizedDecimal(39.9)).toBe(39.9);
  });

  it.each(["", "12,3,4", "abc", null, undefined])("rejects invalid value %s", (input) => {
    expect(parseLocalizedDecimal(input)).toBeUndefined();
  });
});
