"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, Plus } from "lucide-react";
import type { ReactNode } from "react";
import { useFinance } from "@/components/finance-provider";

const navigation = [
  { href: "/dashboard", label: "Resumen" },
  { href: "/movimientos", label: "Movimientos" },
  { href: "/movimientos/nuevo", label: "Anotar" },
  { href: "/importar-exportar", label: "Importar" },
  { href: "/ajustes", label: "Ajustes" },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { session, signOut } = useFinance();

  return (
    <div className="app-frame">
      <header className="nb-top">
        <Link href="/dashboard" className="nb-brand" aria-label="Ir al resumen">Mis&nbsp;gastos</Link>
        <nav className="nb-nav" aria-label="Navegación principal">
          {navigation.map((item) => {
            const active =
              pathname === item.href ||
              (pathname === "/" && item.href === "/dashboard") ||
              (item.href !== "/dashboard" && item.href !== "/movimientos/nuevo" && pathname.startsWith(item.href));
            return (
              <Link href={item.href} key={item.href} className={active ? "active" : ""}>
                {item.label}
              </Link>
            );
          })}
        </nav>
        <span className="nb-spacer" />
        {session ? (
          <span className="nb-account">
            <span className="who">{session.user.email}</span>
            <button className="icon-button subtle" onClick={() => void signOut()} title="Cerrar sesión" aria-label="Cerrar sesión">
              <LogOut size={18} />
            </button>
          </span>
        ) : null}
      </header>

      <main className="main-content">{children}</main>

      {session ? (
        <Link href="/movimientos/nuevo" className="floating-action" aria-label="Anotar un gasto">
          <Plus size={20} />
          <span>Anotar</span>
        </Link>
      ) : null}
    </div>
  );
}
