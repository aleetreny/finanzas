import type { Metadata } from "next";
import { ImportExportView } from "@/components/import-export-view";

export const metadata: Metadata = { title: "Importar y exportar" };

export default function ImportExportPage() {
  return <ImportExportView />;
}
