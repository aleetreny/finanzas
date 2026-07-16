import type { Metadata } from "next";
import { MovementsView } from "@/components/movements-view";

export const metadata: Metadata = { title: "Apuntes" };

export default function MovementsPage() {
  return <MovementsView />;
}
