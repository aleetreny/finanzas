"use client";

import { usePathname } from "next/navigation";
import { Building2, CalendarClock, House, LogOut, MapPinned, Plus, ReceiptText, Settings } from "lucide-react";
import type { ReactNode } from "react";
import { AppLink } from "@/components/app-link";
import { useFinance } from "@/components/finance-provider";

const navigation = [
  { href: "/dashboard", label: "Resumen" },
  { href: "/movimientos", label: "Apuntes" },
  { href: "/movimientos/nuevo", label: "Anotar" },
  { href: "/recurrentes", label: "Recurrentes" },
  { href: "/viajes", label: "Viajes" },
  { href: "/importar-exportar", label: "Importar" },
  { href: "/ajustes", label: "Ajustes" },
];

const mobileNavigation = [
  { href: "/dashboard", label: "Resumen", Icon: House },
  { href: "/movimientos", label: "Apuntes", Icon: ReceiptText },
  { href: "/movimientos/nuevo", label: "Anotar", Icon: Plus, quick: true },
  { href: "/viajes", label: "Viajes", Icon: MapPinned },
  { href: "/ajustes", label: "Ajustes", Icon: Settings },
];

const ownerMobileNavigation = [
  mobileNavigation[0],
  mobileNavigation[1],
  mobileNavigation[2],
  { href: "/piso-malaga", label: "Piso", Icon: Building2 },
  mobileNavigation[4],
];

function isRouteActive(path: string, href: string) {
  if (href === "/dashboard") return path === "/dashboard" || path === "/";
  return path === href;
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { hasMalagaAccess, session, signOut } = useFinance();
  // En la exportación estática las URL llevan barra final: se normaliza para
  // que el subrayado de "activo" funcione igual en local y en GitHub Pages.
  const path = (pathname ?? "/").replace(/\/+$/, "") || "/";

  return (
    <div className={`app-frame${session ? " authenticated" : ""}${hasMalagaAccess ? " malaga-owner" : ""}`}>
      <a href="#main-content" className="skip-link">Saltar al contenido</a>
      <header className="nb-top">
        <AppLink href="/dashboard" className="nb-brand" aria-label="Ir al resumen">Mis&nbsp;gastos</AppLink>
        {session ? (
          <nav className="nb-nav" aria-label="Navegación principal">
            {navigation.flatMap((item) => (
              item.href === "/viajes" && hasMalagaAccess
                ? [item, { href: "/piso-malaga", label: "Piso Málaga" }]
                : [item]
            )).map((item) => {
              const active = isRouteActive(path, item.href);
              return (
                <AppLink href={item.href} key={item.href} className={active ? "active" : ""} aria-current={active ? "page" : undefined}>
                  {item.label}
                </AppLink>
              );
            })}
          </nav>
        ) : null}
        <span className="nb-spacer" />
        {session ? (
          <span className="mobile-header-tools">
            <AppLink
              href="/recurrentes"
              className={`mobile-owner-tool${isRouteActive(path, "/recurrentes") ? " active" : ""}`}
              aria-label="Recurrentes"
              aria-current={isRouteActive(path, "/recurrentes") ? "page" : undefined}
            >
              <CalendarClock size={18} aria-hidden="true" />
              <span>Fijos</span>
            </AppLink>
            {hasMalagaAccess ? (
              <AppLink
                href="/viajes"
                className={`mobile-owner-tool${isRouteActive(path, "/viajes") ? " active" : ""}`}
                aria-label="Viajes"
                aria-current={isRouteActive(path, "/viajes") ? "page" : undefined}
              >
                <MapPinned size={18} aria-hidden="true" />
                <span>Viajes</span>
              </AppLink>
            ) : null}
          </span>
        ) : null}
        {session ? (
          <span className="nb-account">
            <span className="who">{session.user.email}</span>
            <button className="icon-button subtle" onClick={() => void signOut()} title="Cerrar sesión" aria-label="Cerrar sesión">
              <LogOut size={18} />
            </button>
          </span>
        ) : null}
      </header>

      <main id="main-content" className="main-content" tabIndex={-1}>{children}</main>

      {/* En la propia página de anotar sobra (y taparía el botón de guardar) */}
      {session && path !== "/movimientos/nuevo" && path !== "/viajes" ? (
        <AppLink href="/movimientos/nuevo" className="floating-action" aria-label="Anotar un gasto">
          <Plus size={20} />
          <span>Anotar</span>
        </AppLink>
      ) : null}

      {session ? <nav className="mobile-nav" aria-label="Navegación móvil">
          {(hasMalagaAccess ? ownerMobileNavigation : mobileNavigation).map(({ href, label, Icon, quick }) => {
            const active = isRouteActive(path, href);
            return (
              <AppLink
                href={href}
                key={href}
                className={`mobile-nav-link${quick ? " quick" : ""}${active ? " active" : ""}`}
                aria-current={active ? "page" : undefined}
              >
                <Icon size={quick ? 24 : 20} aria-hidden="true" />
                <span>{label}</span>
              </AppLink>
            );
          })}
      </nav> : null}
    </div>
  );
}
