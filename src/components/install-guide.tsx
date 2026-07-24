"use client";

import { Check, ChevronRight, Download, LogIn, MonitorSmartphone, Share, Smartphone } from "lucide-react";
import { useEffect, useState, useSyncExternalStore } from "react";
import { AppLink } from "@/components/app-link";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function detectPlatform() {
  if (typeof navigator === "undefined") return "other" as const;
  const agent = navigator.userAgent.toLowerCase();
  if (/iphone|ipad|ipod/.test(agent)) return "ios" as const;
  if (/android/.test(agent)) return "android" as const;
  return "other" as const;
}

function isStandalone() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(display-mode: standalone)").matches
    || ("standalone" in window.navigator
      && Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone));
}

function subscribeToDisplayMode(onChange: () => void) {
  const media = window.matchMedia("(display-mode: standalone)");
  media.addEventListener("change", onChange);
  window.addEventListener("appinstalled", onChange);
  return () => {
    media.removeEventListener("change", onChange);
    window.removeEventListener("appinstalled", onChange);
  };
}

function subscribeToPlatform() {
  return () => undefined;
}

export function InstallGuide() {
  const platform = useSyncExternalStore(subscribeToPlatform, detectPlatform, () => "other" as const);
  const standalone = useSyncExternalStore(subscribeToDisplayMode, isStandalone, () => false);
  const [installedByEvent, setInstalledByEvent] = useState(false);
  const [promptEvent, setPromptEvent] = useState<InstallPromptEvent | null>(null);
  const [promptDismissed, setPromptDismissed] = useState(false);
  const installed = standalone || installedByEvent;

  useEffect(() => {
    function capturePrompt(event: Event) {
      event.preventDefault();
      setPromptEvent(event as InstallPromptEvent);
    }
    function markInstalled() {
      setInstalledByEvent(true);
      setPromptEvent(null);
    }
    window.addEventListener("beforeinstallprompt", capturePrompt);
    window.addEventListener("appinstalled", markInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", capturePrompt);
      window.removeEventListener("appinstalled", markInstalled);
    };
  }, []);

  async function install() {
    if (!promptEvent) return;
    setPromptDismissed(false);
    await promptEvent.prompt();
    const choice = await promptEvent.userChoice;
    if (choice.outcome === "dismissed") setPromptDismissed(true);
    setPromptEvent(null);
  }

  return (
    <div className="page install-page">
      <header className="install-hero">
        <div className="install-hero-icon"><MonitorSmartphone size={34} /></div>
        <p className="eyebrow">Acceso rápido</p>
        <h1>Pon Mis gastos en tu móvil</h1>
        <p>Se abrirá como una app, a pantalla completa y con su propio icono. No tienes que descargar nada de una tienda.</p>
        {installed ? (
          <div className="install-status success"><Check size={18} />Ya la estás usando como aplicación instalada.</div>
        ) : promptEvent ? (
          <button className="button primary install-now" type="button" onClick={() => void install()}>
            <Download size={18} />Instalar ahora
          </button>
        ) : null}
        {promptDismissed ? <p className="notice">Has cancelado la instalación. Puedes volver a intentarlo desde el menú del navegador.</p> : null}
      </header>

      <nav className="install-platform-tabs" aria-label="Elige tu móvil">
        <a href="#iphone" className={platform === "ios" ? "detected" : ""}>iPhone o iPad</a>
        <a href="#android" className={platform === "android" ? "detected" : ""}>Android</a>
        <a href="#ordenador" className={platform === "other" ? "detected" : ""}>Ordenador</a>
      </nav>

      <section id="iphone" className={`install-section${platform === "ios" ? " recommended" : ""}`}>
        <div className="install-section-heading">
          <span className="install-number">1</span>
          <div><p className="eyebrow">iPhone y iPad</p><h2>Desde Safari</h2></div>
          {platform === "ios" ? <span className="badge green">Tu dispositivo</span> : null}
        </div>
        <ol className="install-steps">
          <li><span>1</span><p>Abre esta misma página en <strong>Safari</strong>. En otros navegadores de iPhone puede no aparecer la opción correcta.</p></li>
          <li><span>2</span><p>Toca el botón <strong>Compartir</strong> <Share size={17} aria-label="icono de compartir" /> de la barra de Safari.</p></li>
          <li><span>3</span><p>Desliza el menú y elige <strong>“Añadir a pantalla de inicio”</strong>.</p></li>
          <li><span>4</span><p>Confirma con <strong>“Añadir”</strong>. Verás el icono “Mis gastos” junto a tus demás apps.</p></li>
        </ol>
      </section>

      <section id="android" className={`install-section${platform === "android" ? " recommended" : ""}`}>
        <div className="install-section-heading">
          <span className="install-number">2</span>
          <div><p className="eyebrow">Android</p><h2>Desde Chrome</h2></div>
          {platform === "android" ? <span className="badge green">Tu dispositivo</span> : null}
        </div>
        <ol className="install-steps">
          <li><span>1</span><p>Abre esta página en <strong>Chrome</strong>.</p></li>
          <li><span>2</span><p>Si ves el botón <strong>“Instalar ahora”</strong> en la parte superior, úsalo. Si no, toca el menú de tres puntos.</p></li>
          <li><span>3</span><p>Elige <strong>“Instalar aplicación”</strong> o <strong>“Añadir a pantalla de inicio”</strong>.</p></li>
          <li><span>4</span><p>Confirma la instalación. El acceso aparecerá en la pantalla de inicio y en tu lista de aplicaciones.</p></li>
        </ol>
      </section>

      <section id="ordenador" className={`install-section${platform === "other" ? " recommended" : ""}`}>
        <div className="install-section-heading">
          <span className="install-number">3</span>
          <div><p className="eyebrow">Chrome o Edge</p><h2>También en el ordenador</h2></div>
        </div>
        <ol className="install-steps compact">
          <li><span>1</span><p>Busca el icono de instalación en la parte derecha de la barra de direcciones.</p></li>
          <li><span>2</span><p>Si no aparece, abre el menú del navegador y elige <strong>“Instalar Mis gastos”</strong>.</p></li>
        </ol>
      </section>

      <aside className="install-after card">
        <Smartphone size={26} />
        <div>
          <h2>Después de instalarla</h2>
          <p>Abre el icono, entra con tu correo y tu clave y úsala con normalidad. Todos los datos siguen sincronizados y privados.</p>
        </div>
        <AppLink href="/dashboard" className="button primary"><LogIn size={17} />Ir a Mis gastos <ChevronRight size={16} /></AppLink>
      </aside>
    </div>
  );
}
