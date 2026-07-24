import type { Metadata } from "next";
import { RecurringView } from "@/components/recurring-view";

export const metadata: Metadata = {
  title: "Recurrentes",
  description: "Programa gastos e ingresos recurrentes en tu libreta personal.",
};

export default function RecurringPage() {
  return <RecurringView />;
}
