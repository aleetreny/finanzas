"use client";

import Link from "next/link";
import { Download, Plus, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { useFinance } from "@/components/finance-provider";
import { PageHeader } from "@/components/page-header";
import { TransactionList } from "@/components/transaction-list";

export function MovementsView() {
  const { transactions, categories } = useFinance();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [direction, setDirection] = useState("all");
  const [year, setYear] = useState("all");
  const years = useMemo(() => [...new Set(transactions.map((row) => row.transaction_date.slice(0, 4)))].sort().reverse(), [transactions]);
  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("es");
    return transactions
      .filter((row) =>
        (!query || `${row.name} ${row.notes ?? ""}`.toLocaleLowerCase("es").includes(query)) &&
        (category === "all" || row.category_id === category) &&
        (direction === "all" || row.direction === direction) &&
        (year === "all" || row.transaction_date.startsWith(year)),
      )
      // lo más reciente primero, pase lo que pase con el orden de origen
      .sort((a, b) => b.transaction_date.localeCompare(a.transaction_date) || (b.created_at ?? "").localeCompare(a.created_at ?? ""));
  }, [category, direction, search, transactions, year]);

  return (
    <div className="page">
      <PageHeader
        eyebrow=""
        title="Apuntes"
        description="Todo lo que has ido apuntando: busca, corrige o tacha."
        action={<Link href="/movimientos/nuevo" className="button primary"><Plus size={16} />Anotar</Link>}
      />
      <div className="toolbar">
        <label className="search-field"><Search size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por nombre o nota" aria-label="Buscar apuntes" /></label>
        <select className="select-field" value={category} onChange={(event) => setCategory(event.target.value)} aria-label="Filtrar categoría"><option value="all">Todas las categorías</option>{categories.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select>
        <select className="select-field" value={direction} onChange={(event) => setDirection(event.target.value)} aria-label="Filtrar tipo"><option value="all">Gastos e ingresos</option><option value="expense">Gastos</option><option value="income">Ingresos</option></select>
        <select className="select-field" value={year} onChange={(event) => setYear(event.target.value)} aria-label="Filtrar año"><option value="all">Todos los años</option>{years.map((item) => <option key={item}>{item}</option>)}</select>
        <span className="badge">{filtered.length.toLocaleString("es-ES")} apuntes</span>
        <Link href="/importar-exportar" className="button small"><Download size={15} />CSV</Link>
      </div>
      <TransactionList transactions={filtered} />
    </div>
  );
}
