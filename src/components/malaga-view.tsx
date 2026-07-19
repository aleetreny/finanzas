"use client";

import { Plus, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { useFinance } from "@/components/finance-provider";
import { PageHeader } from "@/components/page-header";
import { TransactionForm } from "@/components/transaction-form";
import { TransactionList } from "@/components/transaction-list";
import { categoryById, isMalagaTransaction } from "@/lib/finance-scope";
import { formatCurrency } from "@/lib/format";

export function MalagaView() {
  const { transactions, categories, subcategories } = useFinance();
  const [search, setSearch] = useState("");
  const [direction, setDirection] = useState("all");
  const [subcategory, setSubcategory] = useState("all");
  const [year, setYear] = useState("all");
  const [adding, setAdding] = useState(false);

  const categoriesById = useMemo(() => categoryById(categories), [categories]);
  const propertyCategoryIds = useMemo(
    () => new Set(categories.filter((category) => category.category_scope === "property").map((category) => category.id)),
    [categories],
  );
  const propertySubcategories = useMemo(
    () => subcategories.filter((item) => propertyCategoryIds.has(item.category_id)),
    [propertyCategoryIds, subcategories],
  );
  const malagaTransactions = useMemo(
    () => transactions.filter((transaction) => isMalagaTransaction(transaction, categoriesById)),
    [categoriesById, transactions],
  );
  const years = useMemo(
    () => [...new Set(malagaTransactions.map((row) => row.transaction_date.slice(0, 4)))].sort().reverse(),
    [malagaTransactions],
  );
  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("es");
    return malagaTransactions
      .filter((row) =>
        (!query || `${row.name} ${row.notes ?? ""}`.toLocaleLowerCase("es").includes(query)) &&
        (direction === "all" || row.direction === direction) &&
        (subcategory === "all" || row.subcategory_id === subcategory) &&
        (year === "all" || row.transaction_date.startsWith(year)),
      )
      .sort((a, b) => b.transaction_date.localeCompare(a.transaction_date) || (b.created_at ?? "").localeCompare(a.created_at ?? ""));
  }, [direction, malagaTransactions, search, subcategory, year]);

  const income = filtered.reduce((total, row) => total + Math.max(0, row.amount), 0);
  const expenses = filtered.reduce((total, row) => total + Math.abs(Math.min(0, row.amount)), 0);
  const result = income - expenses;

  return (
    <div className="page">
      <PageHeader
        eyebrow=""
        title="Piso Málaga"
        description="Los alquileres, ingresos y gastos del piso están separados del resto de tus finanzas."
        action={<button className="button primary" onClick={() => setAdding(true)}><Plus size={16} />Anotar en el piso</button>}
      />

      <div className="property-summary" aria-label="Resumen del Piso Málaga">
        <div><span>Ingresos</span><strong className="positive">{formatCurrency(income)}</strong></div>
        <div><span>Gastos</span><strong>{formatCurrency(expenses)}</strong></div>
        <div><span>Resultado</span><strong className={result >= 0 ? "positive" : ""}>{formatCurrency(result)}</strong></div>
      </div>

      <div className="toolbar property-toolbar">
        <label className="search-field"><Search size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar en el piso" aria-label="Buscar apuntes del piso" /></label>
        <select className="select-field" value={direction} onChange={(event) => setDirection(event.target.value)} aria-label="Filtrar tipo"><option value="all">Gastos e ingresos</option><option value="expense">Gastos</option><option value="income">Ingresos</option></select>
        <select className="select-field" value={subcategory} onChange={(event) => setSubcategory(event.target.value)} aria-label="Filtrar concepto"><option value="all">Todos los conceptos</option>{propertySubcategories.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select>
        <select className="select-field" value={year} onChange={(event) => setYear(event.target.value)} aria-label="Filtrar año"><option value="all">Todos los años</option>{years.map((item) => <option key={item}>{item}</option>)}</select>
        <span className="badge">{filtered.length.toLocaleString("es-ES")} apuntes</span>
      </div>

      <TransactionList transactions={filtered} formScope="property" />

      {adding ? (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setAdding(false); }}>
          <section className="modal-card" role="dialog" aria-modal="true" aria-label="Anotar movimiento del Piso Málaga">
            <div className="card-header"><div><p className="eyebrow">Piso Málaga</p><h2>Nuevo apunte</h2></div></div>
            <div className="card-body"><TransactionForm scope="property" onSaved={() => setAdding(false)} onCancel={() => setAdding(false)} /></div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
