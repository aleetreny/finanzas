import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AppShell } from "@/components/app-shell";
import { AuthGate } from "@/components/auth-gate";
import { FinanceProvider } from "@/components/finance-provider";
import { PwaRegister } from "@/components/pwa-register";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Finanzas personales",
    template: "%s · Finanzas",
  },
  description: "Panel privado para registrar, revisar y analizar tus finanzas.",
  applicationName: "Finanzas",
  manifest: "/manifest.webmanifest",
  icons: [{ rel: "icon", url: "/icon.svg", type: "image/svg+xml" }],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={`${geistSans.variable} ${geistMono.variable}`}>
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
