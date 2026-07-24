import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import { AppLink } from "@/components/app-link";
import { PageHeader } from "@/components/page-header";
import { TransactionForm } from "@/components/transaction-form";

export const metadata: Metadata = { title: "Anotar movimiento" };

export default function NewMovementPage() {
  return (
    <div className="page" style={{ maxWidth: 560 }}>
      <PageHeader eyebrow="" title="Anotar un gasto" description="Importe, categoría y listo. Lo demás es opcional." action={<AppLink href="/movimientos" className="button"><ArrowLeft size={16} />Volver</AppLink>} />
      <TransactionForm />
    </div>
  );
}
