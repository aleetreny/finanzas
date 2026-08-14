export function parseLocalizedDecimal(value: unknown): number | undefined {
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  if (value === null || value === undefined) return undefined;

  const compact = String(value).trim().replace(/\s/g, "");
  if (!compact || !/^[+-]?[0-9.,]+$/.test(compact)) return undefined;

  const comma = compact.lastIndexOf(",");
  const dot = compact.lastIndexOf(".");
  let normalized = compact;

  if (comma >= 0 && dot >= 0) {
    const decimalSeparator = comma > dot ? "," : ".";
    const thousandsSeparator = decimalSeparator === "," ? "." : ",";
    normalized = compact.split(thousandsSeparator).join("").replace(decimalSeparator, ".");
  } else if (comma >= 0 || dot >= 0) {
    const separator = comma >= 0 ? "," : ".";
    if (compact.split(separator).length > 2) return undefined;
    normalized = compact.replace(separator, ".");
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function parseOptionalLocalizedDecimal(value: unknown): number | null {
  return parseLocalizedDecimal(value) ?? null;
}
