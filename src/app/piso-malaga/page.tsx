import type { Metadata } from "next";
import { MalagaView } from "@/components/malaga-view";

export const metadata: Metadata = { title: "Piso Málaga" };

export default function MalagaPage() {
  return <MalagaView />;
}
