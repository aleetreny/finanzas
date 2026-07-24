"use client";

import { LockKeyhole } from "lucide-react";
import { AppLink } from "@/components/app-link";
import { useFinance } from "@/components/finance-provider";
import { MalagaView } from "@/components/malaga-view";

export function MalagaAccessGate() {
  const { hasMalagaAccess } = useFinance();

  if (hasMalagaAccess) return <MalagaView />;

  return (
    <div className="page restricted-page">
      <div className="card empty-state">
        <LockKeyhole size={30} />
        <h1>Sección privada</h1>
        <p>Piso Málaga solo está disponible en la cuenta propietaria.</p>
        <AppLink href="/dashboard" className="button primary">Volver al resumen</AppLink>
      </div>
    </div>
  );
}
