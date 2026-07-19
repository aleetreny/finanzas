import type { Metadata, Viewport } from "next";
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

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export const metadata: Metadata = {
  title: {
    default: "Mis gastos",
    template: "%s · Mis gastos",
  },
  description: "Mi libreta de gastos, escrita a mano.",
  applicationName: "Mis gastos",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Mis gastos",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: `${basePath}/icon.svg`, type: "image/svg+xml" },
      { url: `${basePath}/icon-192.png`, sizes: "192x192", type: "image/png" },
      { url: `${basePath}/icon-512.png`, sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: `${basePath}/apple-touch-icon.png`, sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
  themeColor: "#f4f0e4",
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
