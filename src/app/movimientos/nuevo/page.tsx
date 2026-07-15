import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { TransactionForm } from "@/components/transaction-form";

export const metadata: Metadata = { title: "Anotar movimiento" };

export default function NewMovementPage() {
  return (
    <div className="page" style={{ maxWidth: 560 }}>
      <PageHeader eyebrow="Registro rápido" title="Anotar" description="Importe, categoría y listo. El resto es opcional." action={<Link href="/movimientos" className="button"><ArrowLeft size={16} />Volver</Link>} />
      <TransactionForm />
    </div>
  );
}
