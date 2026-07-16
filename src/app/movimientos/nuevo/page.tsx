import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { TransactionForm } from "@/components/transaction-form";

export const metadata: Metadata = { title: "Anotar movimiento" };

export default function NewMovementPage() {
  return (
    <div className="page" style={{ maxWidth: 560 }}>
      <PageHeader eyebrow="" title="Anotar un gasto" description="Importe, categoría y listo. Lo demás es opcional." action={<Link href="/movimientos" className="button"><ArrowLeft size={16} />Volver</Link>} />
      <TransactionForm />
    </div>
  );
}
