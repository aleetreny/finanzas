import type { Category, Transaction } from "@/lib/types";

const MALAGA_CONTEXT = "piso málaga";

export function categoryById(categories: Category[]) {
  return new Map(categories.map((category) => [category.id, category]));
}

export function isMalagaTransaction(
  transaction: Transaction,
  categoriesById: Map<string, Category>,
) {
  const context = transaction.context?.trim().toLocaleLowerCase("es") ?? "";
  const category = transaction.category_id
    ? categoriesById.get(transaction.category_id)
    : undefined;

  return context === MALAGA_CONTEXT || category?.category_scope === "property";
}
