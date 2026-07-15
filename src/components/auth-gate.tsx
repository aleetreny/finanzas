"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { Database, LoaderCircle, Mail, ShieldCheck } from "lucide-react";
import { useFinance } from "@/components/finance-provider";

export function AuthGate({ children }: { children: ReactNode }) {
  const { configured, session, loading, error, notice, signIn } = useFinance();
  const [email, setEmail] = useState("");

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
    async function submit(event: FormEvent) {
      event.preventDefault();
      await signIn(email);
    }

    return (
      <div className="auth-card">
        <div className="auth-icon"><ShieldCheck size={24} /></div>
        <p className="eyebrow">Acceso privado</p>
        <h1>Tus finanzas, solo para ti</h1>
        <p>Recibe un enlace de acceso en tu correo. No necesitas contraseña.</p>
        <form onSubmit={submit} className="auth-form">
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
          <button className="button primary" type="submit" disabled={loading}>
            {loading ? <LoaderCircle className="spin" size={18} /> : null}
            Enviarme el enlace
          </button>
        </form>
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
