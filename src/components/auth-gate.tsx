"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { ArrowLeft, Database, ExternalLink, KeyRound, LoaderCircle, Mail, ShieldCheck } from "lucide-react";
import { useFinance } from "@/components/finance-provider";

export function AuthGate({ children }: { children: ReactNode }) {
  const { configured, session, loading, error, notice, sendAccessLink, signInWithPassword } = useFinance();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"password" | "link">("password");
  const [linkRequested, setLinkRequested] = useState(false);
  const setupUrl = `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/ajustes/?configurar-acceso=1`;

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

  if (!session) {
    async function submitPassword(event: FormEvent) {
      event.preventDefault();
      await signInWithPassword(email.trim(), password);
    }

    async function submitLink(event: FormEvent) {
      event.preventDefault();
      const sent = await sendAccessLink(email.trim());
      if (sent) setLinkRequested(true);
    }

    return (
      <div className="auth-card">
        <div className="auth-icon"><ShieldCheck size={24} /></div>
        <p className="eyebrow">Acceso privado</p>
        {mode === "password" ? (
          <>
            <h1>Entrar en Mis gastos</h1>
            <p>Usa la clave que configuraste para abrir tu libreta directamente desde este dispositivo.</p>
            <form onSubmit={submitPassword} className="auth-form">
              <label htmlFor="auth-email">Correo electrónico</label>
              <div className="input-with-icon">
                <Mail size={18} />
                <input
                  id="auth-email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="tu@correo.com"
                  required
                  autoComplete="email"
                />
              </div>
              <label htmlFor="auth-password">Clave</label>
              <div className="input-with-icon">
                <KeyRound size={18} />
                <input
                  id="auth-password"
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
            <button className="auth-switch" type="button" onClick={() => setMode("link")}>
              Es mi primera vez o todavía no tengo clave
            </button>
          </>
        ) : (
          <>
            <h1>Crear tu acceso</h1>
            <p>
              Te enviaremos un enlace a tu correo. Al abrirlo verás la pantalla para crear tu clave; si es tu primera vez, se creará tu propia libreta con sus categorías ya preparadas.
            </p>
            <form onSubmit={submitLink} className="auth-form">
              <label htmlFor="auth-email">Correo electrónico</label>
              <div className="input-with-icon">
                <Mail size={18} />
                <input
                  id="auth-email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="tu@correo.com"
                  required
                  autoComplete="email"
                />
              </div>
              <button className="button primary" type="submit" disabled={loading || linkRequested}>
                {loading ? <LoaderCircle className="spin" size={18} /> : null}
                {linkRequested ? "Correo enviado" : "Enviarme el enlace"}
              </button>
            </form>
            <div className="safari-resume">
              <p>¿Ya abriste uno de los correos? No solicites otro. Continúa en Safari para crear la clave con la sesión que ya está abierta allí.</p>
              <a className="button" href={setupUrl} target="_blank" rel="noopener noreferrer">
                Continuar en Safari <ExternalLink size={16} />
              </a>
            </div>
            <button className="auth-switch" type="button" onClick={() => setMode("password")}>
              <ArrowLeft size={16} /> Ya tengo una clave
            </button>
          </>
        )}
        {notice ? <p className="notice success">{notice}</p> : null}
        {error ? <p className="notice error">{error}</p> : null}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="loading-state">
        <LoaderCircle className="spin" />
        <p>Preparando tus datos…</p>
      </div>
    );
  }

  return <>{children}</>;
}
