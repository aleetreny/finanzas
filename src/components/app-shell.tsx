"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2,
  CalendarClock,
  ChartNoAxesCombined,
  ChevronRight,
  FileUp,
  Landmark,
  LogOut,
  Menu,
  Plus,
  ReceiptText,
  Settings,
  WalletCards,
  X,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { useFinance } from "@/components/finance-provider";

const navigation = [
  { href: "/dashboard", label: "Resumen", icon: ChartNoAxesCombined },
  { href: "/movimientos", label: "Movimientos", icon: ReceiptText },
  { href: "/piso-malaga", label: "Piso Málaga", icon: Building2 },
  { href: "/reservas", label: "Reservas", icon: CalendarClock },
  { href: "/recurrentes", label: "Recurrentes", icon: WalletCards },
  { href: "/inmovilizado", label: "Inmovilizado", icon: Landmark },
  { href: "/importar-exportar", label: "Importar / exportar", icon: FileUp },
  { href: "/ajustes", label: "Ajustes", icon: Settings },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const { session, signOut } = useFinance();

  return (
    <div className="app-frame">
      <header className="mobile-header">
        <Link href="/dashboard" className="brand compact" aria-label="Ir al resumen">
          <span className="brand-mark">F</span>
          <span>Finanzas</span>
        </Link>
        <button className="icon-button" onClick={() => setMenuOpen((open) => !open)} aria-label="Abrir menú">
          {menuOpen ? <X /> : <Menu />}
        </button>
      </header>

      <aside className={`sidebar ${menuOpen ? "open" : ""}`}>
        <Link href="/dashboard" className="brand" onClick={() => setMenuOpen(false)}>
          <span className="brand-mark">F</span>
          <span>
            <strong>Finanzas</strong>
            <small>Panel personal</small>
          </span>
        </Link>
        <nav className="nav-list" aria-label="Navegación principal">
          {navigation.map((item) => {
            const active = pathname === item.href || (pathname === "/" && item.href === "/dashboard");
            const Icon = item.icon;
            return (
              <Link
                href={item.href}
                key={item.href}
                className={active ? "active" : ""}
                onClick={() => setMenuOpen(false)}
              >
                <Icon size={19} />
                <span>{item.label}</span>
                {active ? <ChevronRight className="nav-arrow" size={16} /> : null}
              </Link>
            );
          })}
        </nav>
        {session ? (
          <div className="sidebar-account">
            <span className="avatar">{session.user.email?.[0]?.toUpperCase() ?? "U"}</span>
            <span className="account-copy">
              <strong>{session.user.email?.split("@")[0]}</strong>
              <small>{session.user.email}</small>
            </span>
            <button className="icon-button subtle" onClick={() => void signOut()} title="Cerrar sesión">
              <LogOut size={18} />
            </button>
          </div>
        ) : null}
      </aside>

      {menuOpen ? <button className="menu-backdrop" aria-label="Cerrar menú" onClick={() => setMenuOpen(false)} /> : null}
      <main className="main-content">{children}</main>
      {session ? (
        <Link href="/movimientos/nuevo" className="floating-action">
          <Plus size={21} />
          <span>Añadir</span>
        </Link>
      ) : null}
    </div>
  );
}
