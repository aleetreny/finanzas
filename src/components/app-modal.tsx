"use client";

import { X } from "lucide-react";
import { useEffect, useId, useRef, type KeyboardEvent, type ReactNode } from "react";

const FOCUSABLE = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

export function AppModal({
  title,
  eyebrow,
  onClose,
  children,
  className = "",
}: {
  title: string;
  eyebrow: string;
  onClose: () => void;
  children: ReactNode;
  className?: string;
}) {
  const titleId = useId();
  const panelRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const previousFocus = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, []);

  function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key !== "Tab") return;
    const focusable = [...(panelRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])]
      .filter((element) => element.offsetParent !== null);
    if (!focusable.length) {
      event.preventDefault();
      return;
    }
    const first = focusable[0];
    const last = focusable.at(-1)!;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}
    >
      <section
        ref={panelRef}
        className={`modal-card${className ? ` ${className}` : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onKeyDown={handleKeyDown}
      >
        <div className="card-header">
          <div><p className="eyebrow">{eyebrow}</p><h2 id={titleId}>{title}</h2></div>
          <button ref={closeRef} className="icon-button modal-close" type="button" onClick={onClose} aria-label={`Cerrar ${title}`}><X size={20} /></button>
        </div>
        <div className="card-body">{children}</div>
      </section>
    </div>
  );
}
