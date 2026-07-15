import type { Metadata } from "next";
import { RecurringView } from "@/components/recurring-view";

export const metadata: Metadata = { title: "Recurrentes" };

export default function RecurringPage() {
  return <RecurringView />;
}
