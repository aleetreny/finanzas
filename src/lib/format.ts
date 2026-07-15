const euroFormatter = new Intl.NumberFormat("es-ES", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
});

const dateFormatter = new Intl.DateTimeFormat("es-ES", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

export function formatCurrency(value: number) {
  return euroFormatter.format(value);
}

export function formatDate(value: string) {
  return dateFormatter.format(new Date(`${value}T00:00:00Z`));
}

export function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function monthKey(value: string) {
  return value.slice(0, 7);
}
