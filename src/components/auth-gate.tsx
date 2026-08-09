"use client";

import { usePathname } from "next/navigation";
import {
  Database,
  KeyRound,
  LoaderCircle,
  Mail,
  ShieldCheck,
  Smartphone,
} from "lucide-react";
import { useState, type FormEvent, type ReactNode } from "react";
import { AppLink } from "@/components/app-link";
import { useFinance } from "@/components/finance-provider";

export function AuthGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const {
    configured,
    session,
    loading,
    error,
    signInWithPassword,
  } = useFinance();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const normalizedPath = (pathname ?? "/").replace(/\/+$/, "") || "/";

  // Las instrucciones de instalación deben poder consultarse antes de iniciar
  // sesión, por ejemplo desde el mismo móvil que se quiere instalar.
  if (normalizedPath === "/instalar") return <>{children}</>;

  if (!configured) {
    return (
      <div className="auth-card">
        <div className="auth-icon"><Database size={24} /></div>
        <p className="eyebrow">Configuración pendiente</p>
        <h1>Conecta el proyecto de Supabase</h1>
        <p>
          Añade <code>NEXT_PUBLIC_SUPABASE_URL</code> y{" "}
          <code>NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</code>. La aplicación ya
          está preparada para usar RLS y la clave pública segura.
        </p>
      </div>
    );
  }

  // Mientras se restaura una sesión existente no se muestra ni se enfoca por
  // un instante el formulario público de acceso.
  if (loading) {
    return (
      <div className="loading-state">
        <LoaderCircle className="spin" />
        <p>{session ? "Preparando tus datos…" : "Comprobando tu sesión…"}</p>
      </div>
    );
  }

  if (!session) {
    async function submitPassword(event: FormEvent) {
      event.preventDefault();
      await signInWithPassword(email.trim(), password);
    }

    return (
      <div className="auth-card">
        <div className="auth-icon"><ShieldCheck size={24} /></div>
        <p className="eyebrow">Acceso personal</p>
        <h1>Entrar en Mis gastos</h1>
        <p>Accede a tu libreta privada con tu correo y tu clave.</p>
        <form onSubmit={submitPassword} className="auth-form">
          <label htmlFor="auth-login-email">Correo electrónico</label>
          <div className="input-with-icon">
            <Mail size={18} aria-hidden="true" />
            <input
              id="auth-login-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="tu@correo.com"
              required
              autoComplete="email"
              autoFocus
            />
          </div>
          <label htmlFor="auth-login-password">Clave</label>
          <div className="input-with-icon">
            <KeyRound size={18} aria-hidden="true" />
            <input
              id="auth-login-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Tu clave privada"
              required
              minLength={10}
              autoComplete="current-password"
            />
          </div>
          <button className="button primary" type="submit" disabled={loading}>
            {loading ? <LoaderCircle className="spin" size={18} /> : null}
            Entrar
          </button>
        </form>

        <AppLink href="/instalar" className="auth-install-link">
          <Smartphone size={17} aria-hidden="true" /> Cómo instalar la app en el móvil
        </AppLink>
        <div className="auth-feedback" aria-live="polite">
          {error ? <p className="notice error" role="alert">{error}</p> : null}
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
