"use client";

import { Download, Plus, Search } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { AppLink } from "@/components/app-link";
import { useFinance } from "@/components/finance-provider";
import { PageHeader } from "@/components/page-header";
import { TransactionList } from "@/components/transaction-list";
import { categoryById, isMalagaTransaction } from "@/lib/finance-scope";

const MONTHS = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

export function MovementsView() {
  const { transactions, categories, subcategories, hasMalagaAccess } = useFinance();
  const searchParams = useSearchParams();
  const requestedPeriod = searchParams.get("month") ?? "";
  const validPeriod = /^\d{4}-(0[1-9]|1[0-2])$/.test(requestedPeriod);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState(() => searchParams.get("category") ?? "all");
  const [subcategory, setSubcategory] = useState(() => searchParams.get("subcategory") ?? "all");
  const [year, setYear] = useState(() => validPeriod
    ? requestedPeriod.slice(0, 4)
    : searchParams.get("year") ?? "all");
  const [month, setMonth] = useState(() => validPeriod ? requestedPeriod.slice(5, 7) : "all");
  const categoriesById = useMemo(() => categoryById(categories), [categories]);
  const personalTransactions = useMemo(
    () => transactions.filter((row) => !isMalagaTransaction(row, categoriesById)),
    [categoriesById, transactions],
  );
  const visibleCategories = useMemo(
    () => categories.filter((item) => item.category_scope !== "property"),
    [categories],
  );
  const visibleCategoryIds = useMemo(
    () => new Set(visibleCategories.map((item) => item.id)),
    [visibleCategories],
  );
  const visibleSubcategories = useMemo(
    () => subcategories.filter((item) =>
      item.is_active
      && visibleCategoryIds.has(item.category_id)
      && (category === "all" || item.category_id === category)),
    [category, subcategories, visibleCategoryIds],
  );
  const years = useMemo(
    () => [...new Set(personalTransactions.map((row) => row.transaction_date.slice(0, 4)))].sort().reverse(),
    [personalTransactions],
  );
  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("es");
    return personalTransactions
      .filter((row) =>
        (!query || `${row.name} ${row.notes ?? ""}`.toLocaleLowerCase("es").includes(query))
        && (category === "all" || row.category_id === category)
        && (subcategory === "all"
          || (subcategory === "none" ? !row.subcategory_id : row.subcategory_id === subcategory))
        && (year === "all" || row.transaction_date.startsWith(year))
        && (month === "all" || row.transaction_date.slice(5, 7) === month),
      )
      .sort((a, b) =>
        b.transaction_date.localeCompare(a.transaction_date)
        || (b.created_at ?? "").localeCompare(a.created_at ?? ""));
  }, [category, month, personalTransactions, search, subcategory, year]);

  function changeCategory(nextCategory: string) {
    setCategory(nextCategory);
    setSubcategory("all");
  }

  return (
    <div className="page">
      <PageHeader
        eyebrow=""
        title="Apuntes"
        description={hasMalagaAccess
          ? "Tus gastos e ingresos personales. El Piso Málaga vive únicamente en su propia pestaña."
          : "Todos tus gastos e ingresos, ordenados y fáciles de encontrar."}
        action={<AppLink href="/movimientos/nuevo" className="button primary"><Plus size={16} />Anotar</AppLink>}
      />
      <div className="toolbar">
        <label className="search-field">
          <Search size={17} />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar por nombre o nota"
            aria-label="Buscar apuntes"
          />
        </label>
        <select className="select-field" value={category} onChange={(event) => changeCategory(event.target.value)} aria-label="Filtrar categoría">
          <option value="all">Todas las categorías</option>
          {visibleCategories.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}
        </select>
        <select className="select-field" value={subcategory} onChange={(event) => setSubcategory(event.target.value)} aria-label="Filtrar subcategoría">
          <option value="all">Todas las subcategorías</option>
          <option value="none">Sin subcategoría</option>
          {visibleSubcategories.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}
        </select>
        <select className="select-field" value={year} onChange={(event) => setYear(event.target.value)} aria-label="Filtrar año">
          <option value="all">Todos los años</option>
          {years.map((item) => <option key={item}>{item}</option>)}
        </select>
        <select className="select-field" value={month} onChange={(event) => setMonth(event.target.value)} aria-label="Filtrar mes">
          <option value="all">Todos los meses</option>
          {MONTHS.map((item, index) => (
            <option value={String(index + 1).padStart(2, "0")} key={item}>{item}</option>
          ))}
        </select>
        <span className="badge">{filtered.length.toLocaleString("es-ES")} apuntes</span>
        <AppLink href="/importar-exportar" className="button small"><Download size={15} />CSV</AppLink>
      </div>
      <TransactionList transactions={filtered} />
    </div>
  );
}
