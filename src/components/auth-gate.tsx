"use client";

import { usePathname } from "next/navigation";
import {
  ArrowLeft,
  Database,
  KeyRound,
  LoaderCircle,
  Mail,
  ShieldCheck,
  Smartphone,
  UserRound,
} from "lucide-react";
import { useState, type FormEvent, type ReactNode } from "react";
import { AppLink } from "@/components/app-link";
import { useFinance } from "@/components/finance-provider";

type AuthMode = "login" | "signup" | "recovery";

export function AuthGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const {
    configured,
    session,
    loading,
    error,
    notice,
    sendAccessLink,
    signInWithPassword,
    signUp,
  } = useFinance();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordRepeat, setPasswordRepeat] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [mode, setMode] = useState<AuthMode>("login");
  const [linkRequested, setLinkRequested] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const normalizedPath = (pathname ?? "/").replace(/\/+$/, "") || "/";

  // Las instrucciones de instalación deben poder consultarse antes de crear
  // una cuenta, por ejemplo desde el mismo móvil que se quiere instalar.
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
      setValidationError(null);
      await signInWithPassword(email.trim(), password);
    }

    async function submitSignup(event: FormEvent) {
      event.preventDefault();
      setValidationError(null);
      if (password.length < 10) {
        setValidationError("La clave debe tener al menos 10 caracteres.");
        return;
      }
      if (password !== passwordRepeat) {
        setValidationError("Las dos claves no coinciden.");
        return;
      }
      try {
        await signUp(email.trim(), password, displayName);
      } catch {
        // FinanceProvider muestra el mensaje normalizado.
      }
    }

    async function submitRecovery(event: FormEvent) {
      event.preventDefault();
      setValidationError(null);
      const sent = await sendAccessLink(email.trim());
      if (sent) setLinkRequested(true);
    }

    function changeMode(nextMode: AuthMode) {
      setMode(nextMode);
      setValidationError(null);
      setLinkRequested(false);
      setPassword("");
      setPasswordRepeat("");
    }

    return (
      <div className="auth-card">
        <div className="auth-icon"><ShieldCheck size={24} /></div>
        <p className="eyebrow">Tu libreta personal</p>

        {mode === "login" ? (
          <>
            <h1>Entrar en Mis gastos</h1>
            <p>Accede a tus datos privados con tu correo y tu clave.</p>
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
            <div className="auth-actions">
              <button className="auth-switch" type="button" onClick={() => changeMode("signup")}>
                Crear una cuenta nueva
              </button>
              <button className="auth-switch muted" type="button" onClick={() => changeMode("recovery")}>
                He olvidado mi clave
              </button>
            </div>
          </>
        ) : null}

        {mode === "signup" ? (
          <>
              <h1>Crear una cuenta</h1>
              <p>Empezarás desde cero. Tus apuntes serán privados, estarán separados de las demás cuentas y entrarás al terminar.</p>
              <form onSubmit={submitSignup} className="auth-form">
                <label htmlFor="auth-signup-name">Nombre</label>
                <div className="input-with-icon">
                  <UserRound size={18} aria-hidden="true" />
                  <input
                    id="auth-signup-name"
                    type="text"
                    value={displayName}
                    onChange={(event) => setDisplayName(event.target.value)}
                    placeholder="Cómo quieres que te llamemos"
                    required
                    autoComplete="name"
                    autoFocus
                  />
                </div>
                <label htmlFor="auth-signup-email">Correo electrónico</label>
                <div className="input-with-icon">
                  <Mail size={18} aria-hidden="true" />
                  <input
                    id="auth-signup-email"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="tu@correo.com"
                    required
                    autoComplete="email"
                  />
                </div>
                <label htmlFor="auth-signup-password">Clave</label>
                <div className="input-with-icon">
                  <KeyRound size={18} aria-hidden="true" />
                  <input
                    id="auth-signup-password"
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="10 caracteres como mínimo"
                    required
                    minLength={10}
                    autoComplete="new-password"
                    aria-describedby="signup-password-help"
                  />
                </div>
                <span id="signup-password-help" className="field-hint">Usa una clave única de al menos 10 caracteres.</span>
                <label htmlFor="auth-signup-password-repeat">Repite la clave</label>
                <div className="input-with-icon">
                  <KeyRound size={18} aria-hidden="true" />
                  <input
                    id="auth-signup-password-repeat"
                    type="password"
                    value={passwordRepeat}
                    onChange={(event) => setPasswordRepeat(event.target.value)}
                    placeholder="La misma clave"
                    required
                    minLength={10}
                    autoComplete="new-password"
                  />
                </div>
                <button className="button primary" type="submit" disabled={loading}>
                  {loading ? <LoaderCircle className="spin" size={18} /> : null}
                  Crear mi cuenta
                </button>
              </form>
              <button className="auth-switch" type="button" onClick={() => changeMode("login")}>
                <ArrowLeft size={16} /> Ya tengo una cuenta
              </button>
          </>
        ) : null}

        {mode === "recovery" ? (
          <>
            <h1>Recuperar el acceso</h1>
            <p>Te enviaremos un enlace seguro para entrar y establecer una clave nueva desde Ajustes.</p>
            <form onSubmit={submitRecovery} className="auth-form">
              <label htmlFor="auth-recovery-email">Correo electrónico</label>
              <div className="input-with-icon">
                <Mail size={18} aria-hidden="true" />
                <input
                  id="auth-recovery-email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="tu@correo.com"
                  required
                  autoComplete="email"
                  autoFocus
                />
              </div>
              <button className="button primary" type="submit" disabled={loading || linkRequested}>
                {loading ? <LoaderCircle className="spin" size={18} /> : null}
                {linkRequested ? "Enlace enviado" : "Enviarme el enlace"}
              </button>
            </form>
            <button className="auth-switch" type="button" onClick={() => changeMode("login")}>
              <ArrowLeft size={16} /> Volver a entrar
            </button>
          </>
        ) : null}

        <AppLink href="/instalar" className="auth-install-link">
          <Smartphone size={17} aria-hidden="true" /> Cómo instalar la app en el móvil
        </AppLink>
        <div className="auth-feedback" aria-live="polite">
          {notice ? <p className="notice success">{notice}</p> : null}
          {validationError ? <p className="notice error" role="alert">{validationError}</p> : null}
          {error ? <p className="notice error" role="alert">{error}</p> : null}
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
