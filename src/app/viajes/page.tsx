import type { Metadata } from "next";
import { TripsView } from "@/components/trips-view";

export const metadata: Metadata = {
  title: "Viajes",
  description: "Organiza y revisa el desglose de gastos de cada viaje.",
};

export default function TripsPage() {
  return <TripsView />;
}
