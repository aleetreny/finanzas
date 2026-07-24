import type { Metadata } from "next";
import { MalagaAccessGate } from "@/components/malaga-access-gate";

export const metadata: Metadata = { title: "Piso Málaga" };

export default function MalagaPage() {
  return <MalagaAccessGate />;
}
