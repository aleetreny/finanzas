import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import Papa from "papaparse";
import { describe, expect, it } from "vitest";

type Row = {
  id_origen: string;
  importe_eur: string;
  fecha: string;
  categoria_principal: string;
  subcategoria: string;
};

const csv = readFileSync(resolve(process.cwd(), "movimientos_financieros_corregidos.csv"), "utf8").replace(/^\uFEFF/, "");
const parsed = Papa.parse<Row>(csv, { header: true, delimiter: ";", skipEmptyLines: "greedy" });

describe("historical CSV", () => {
  it("contains exactly 1,024 valid movements and the audited total", () => {
    expect(parsed.errors).toEqual([]);
    expect(parsed.data).toHaveLength(1024);
    const cents = parsed.data.reduce((sum, row) => sum + Math.round(Number(row.importe_eur) * 100), 0);
    expect(cents).toBe(1_427_666);
  });

  it("has stable unique IDs so importing twice is idempotent", () => {
    const ids = parsed.data.map((row) => row.id_origen);
    expect(new Set(ids).size).toBe(ids.length);
    const importedTwice = new Map([...parsed.data, ...parsed.data].map((row) => [row.id_origen, row]));
    expect(importedTwice.size).toBe(1024);
  });

  it("keeps dates in ISO format", () => {
    expect(parsed.data.every((row) => /^\d{4}-\d{2}-\d{2}$/.test(row.fecha))).toBe(true);
  });

  it("removes the sublet parking and migrates personal care below health", () => {
    expect(parsed.data.some((row) => row.categoria_principal === "Parking subarrendado")).toBe(false);
    const personalCare = parsed.data.filter((row) => row.subcategoria === "Cuidado personal");
    expect(personalCare).toHaveLength(8);
    expect(personalCare.every((row) => row.categoria_principal === "Salud")).toBe(true);
  });
});
