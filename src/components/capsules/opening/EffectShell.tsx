"use client";

import { createContext, useContext, useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import "@/components/capsules/opening/opening.css";
import type { CapsuleOpenEffect } from "@/domain/capsules/open-effects";
import { cn } from "@/lib/utils";

/**
 * Dentro l'anteprima del proprietario ("Così la vedrà chi la riceve") la finestra si presenta come tale: nome, cartellino in alto
 * a sinistra e "Chiudi anteprima". Fuori (apertura vera, "Provalo") il contesto è assente e non cambia nulla.
 */
export const OpenPreviewContext = createContext(false);

/**
 * L'involucro comune dei cinque effetti: una finestra a tutto schermo (`role="dialog"`, "Capsula condivisa") che si chiude con
 * Esc, con un pulsante "Chiudi" sempre raggiungibile. `data-effect` dice quale effetto è in scena.
 */
export function EffectShell({
  effect,
  className,
  style,
  onClose,
  closeTone = "light",
  children,
}: {
  effect: CapsuleOpenEffect;
  className?: string;
  style?: CSSProperties;
  onClose: () => void;
  /** Il colore del pulsante di chiusura, secondo lo sfondo. */
  closeTone?: "light" | "dark";
  children: ReactNode;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const isPreview = useContext(OpenPreviewContext);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div role="dialog" aria-modal="true" aria-label={isPreview ? "Anteprima capsula" : "Capsula condivisa"} data-effect={effect} className={cn("fixed inset-0 z-50 capsule-open", className)} style={style}>
      {children}
      {isPreview ? (
        <p className="pointer-events-none absolute left-3 top-3 z-[60] rounded-full bg-black/55 px-3 py-1 text-xs font-semibold text-white backdrop-blur-sm">
          Così la vedrà chi la riceve
        </p>
      ) : null}
      <button
        ref={closeRef}
        type="button"
        onClick={onClose}
        aria-label={isPreview ? "Chiudi anteprima" : "Chiudi"}
        className={cn(
          "absolute right-3 top-3 z-[60] flex h-9 w-9 items-center justify-center rounded-full text-sm",
          closeTone === "dark" ? "bg-white/15 text-white hover:bg-white/25" : "bg-black/10 text-zinc-800 hover:bg-black/15 dark:bg-white/10 dark:text-zinc-100",
        )}
      >
        ✕
      </button>
    </div>
  );
}
