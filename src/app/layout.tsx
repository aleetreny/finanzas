import type { Metadata } from "next";
import { Fraunces, IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import { AppShell } from "@/components/app-shell";
import { AuthGate } from "@/components/auth-gate";
import { FinanceProvider } from "@/components/finance-provider";
import { PwaRegister } from "@/components/pwa-register";
import "./globals.css";

// Fraunces da el carácter de "cuaderno": serif de contraste alto, cálida, nada
// que ver con la Geist por defecto de create-next-app.
const serif = Fraunces({
  variable: "--font-serif",
  subsets: ["latin"],
  display: "swap",
  style: ["normal", "italic"],
});

const sans = IBM_Plex_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

// Cifras y etiquetas: monoespaciada, para que las columnas de importes cuadren
// como en una libreta de contabilidad.
const mono = IBM_Plex_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Cuaderno de cuentas",
    template: "%s · Cuaderno",
  },
  description: "Libreta privada para anotar y revisar tus finanzas.",
  applicationName: "Cuaderno",
  manifest: "/manifest.webmanifest",
  icons: [{ rel: "icon", url: "/icon.svg", type: "image/svg+xml" }],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={`${serif.variable} ${sans.variable} ${mono.variable}`}>
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
