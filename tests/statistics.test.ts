import { describe, expect, it } from "vitest";
import { median } from "../src/lib/statistics";

describe("median", () => {
  it("returns zero when there are no samples", () => {
    expect(median([])).toBe(0);
  });

  it("returns the middle value for an odd number of samples", () => {
    expect(median([30, 10, 20])).toBe(20);
  });

  it("averages the two middle values for an even number of samples", () => {
    expect(median([100, 110, 120, 130, 140, 1_000])).toBe(125);
  });
});
