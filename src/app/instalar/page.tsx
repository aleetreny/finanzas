import type { Metadata } from "next";
import { InstallGuide } from "@/components/install-guide";

export const metadata: Metadata = {
  title: "Instalar en el móvil",
  description: "Instrucciones para instalar Mis gastos en iPhone, Android y ordenador.",
};

export default function InstallPage() {
  return <InstallGuide />;
}
