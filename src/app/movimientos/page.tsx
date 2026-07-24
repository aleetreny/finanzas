import type { Metadata } from "next";
import { Suspense } from "react";
import { MovementsView } from "@/components/movements-view";

export const metadata: Metadata = { title: "Apuntes" };

export default function MovementsPage() {
  return (
    <Suspense fallback={<div className="page loading-state"><p>Cargando apuntes…</p></div>}>
      <MovementsView />
    </Suspense>
  );
}
