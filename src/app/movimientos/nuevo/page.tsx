import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { TransactionForm } from "@/components/transaction-form";

export const metadata: Metadata = { title: "Nuevo movimiento" };

export default function NewMovementPage() {
  return (
    <div className="page">
      <PageHeader eyebrow="Registro rápido" title="Nuevo movimiento" description="Los campos esenciales primero; el detalle avanzado queda oculto hasta que lo necesites." action={<Link href="/movimientos" className="button"><ArrowLeft size={16} />Volver</Link>} />
      <section className="card form-card"><div className="card-body"><TransactionForm /></div></section>
    </div>
  );
}
