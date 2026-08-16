import type { Transaction } from "@/lib/types";

// Cuántos gastos anteriores se revisan al anotar uno nuevo.
export const DUPLICATE_LOOKBACK = 10;

// Los importes se guardan con dos decimales: medio céntimo basta como margen.
const AMOUNT_TOLERANCE = 0.005;

export type DuplicateCandidate = {
  amount: number;
  category_id: string | null;
  subcategory_id: string | null;
};

function normalizeId(value: string | null | undefined) {
  return value ? value : null;
}

// "Los últimos gastos metidos" es el orden de alta (created_at), no el de la
// fecha del cargo. La fecha y el id desempatan para que el orden sea estable
// cuando varias filas comparten created_at (el histórico importado, por ejemplo).
function byEntryOrder(first: Transaction, second: Transaction) {
  if (first.created_at !== second.created_at) return first.created_at < second.created_at ? 1 : -1;
  if (first.transaction_date !== second.transaction_date) return first.transaction_date < second.transaction_date ? 1 : -1;
  return first.id < second.id ? 1 : -1;
}

export function recentExpenses(
  transactions: Transaction[],
  { limit = DUPLICATE_LOOKBACK, excludeId = null }: { limit?: number; excludeId?: string | null } = {},
) {
  return transactions
    .filter((transaction) => transaction.direction === "expense" && transaction.id !== excludeId)
    .sort(byEntryOrder)
    .slice(0, limit);
}

function sameAmount(first: number, second: number) {
  return Math.abs(Math.abs(first) - Math.abs(second)) < AMOUNT_TOLERANCE;
}

// Un gasto sin categoría no se compara: no hay coincidencia que señalar.
function sameCategories(candidate: DuplicateCandidate, existing: Transaction) {
  const category = normalizeId(candidate.category_id);
  if (!category || category !== normalizeId(existing.category_id)) return false;
  const candidateSub = normalizeId(candidate.subcategory_id);
  const existingSub = normalizeId(existing.subcategory_id);
  // Si a uno de los dos le falta la subcategoría, la categoría ya es suficiente:
  // el aviso interesa aunque el apunte anterior se detallara con menos precisión.
  return !candidateSub || !existingSub || candidateSub === existingSub;
}

// Devuelve el gasto anterior más reciente que coincide en importe y categorías,
// o null si ninguno de los últimos coincide.
export function findDuplicateExpense(
  candidate: DuplicateCandidate,
  transactions: Transaction[],
  options: { limit?: number; excludeId?: string | null } = {},
): Transaction | null {
  if (!Number.isFinite(candidate.amount) || !candidate.amount) return null;
  return recentExpenses(transactions, options).find((existing) =>
    sameAmount(existing.amount, candidate.amount) && sameCategories(candidate, existing)) ?? null;
}
