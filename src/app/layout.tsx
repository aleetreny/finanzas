import type { Metadata } from "next";
import { Caveat, Kalam } from "next/font/google";
import { AppShell } from "@/components/app-shell";
import { AuthGate } from "@/components/auth-gate";
import { FinanceProvider } from "@/components/finance-provider";
import { PwaRegister } from "@/components/pwa-register";
import "./globals.css";

// Todo escrito a mano. Caveat para los grandes trazos (títulos, cifras), Kalam
// para el texto que hay que leer del tirón (etiquetas, datos).
const display = Caveat({
  variable: "--font-display",
  subsets: ["latin"],
  display: "swap",
});

const hand = Kalam({
  variable: "--font-hand",
  subsets: ["latin"],
  weight: ["300", "400", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Mis gastos",
    template: "%s · Mis gastos",
  },
  description: "Mi libreta de gastos, escrita a mano.",
  applicationName: "Mis gastos",
  manifest: "/manifest.webmanifest",
  icons: [{ rel: "icon", url: "/icon.svg", type: "image/svg+xml" }],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={`${display.variable} ${hand.variable}`}>
      <body>
        <FinanceProvider>
          <PwaRegister />
          <AppShell>
            <AuthGate>{children}</AuthGate>
          </AppShell>
        </FinanceProvider>
      </body>
    </html>
  );
}
