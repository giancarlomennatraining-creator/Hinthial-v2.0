"use client";

import "@/components/crypto/unlock.css";
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import Link from "next/link";
import { createPortal } from "react-dom";
import type { UnlockPhase } from "@/components/crypto/unlock/useUnlockFlow";
import { UNLOCK_EXIT_MS, type UnlockStyle } from "@/lib/unlock-style";
import { cn } from "@/lib/utils";

/** Quando far partire la dissolvenza del velo dopo lo sblocco, e quanto dura: la cassaforte aspetta che la porta si apra. */
const VEIL_FADE: Record<UnlockStyle, { delayMs: number; durationMs: number }> = {
  glass: { delayMs: 450, durationMs: 650 },
  vault: { delayMs: 900, durationMs: 1600 },
  fingerprint: { delayMs: 150, durationMs: 900 },
};

/** Con "meno movimento" lo sblocco riuscito chiude la finestra quasi subito, senza animazioni. */
const REDUCED_EXIT_MS = 250;

const REDUCED_QUERY = "(prefers-reduced-motion: reduce)";

function subscribeReducedMotion(callback: () => void) {
  const query = window.matchMedia(REDUCED_QUERY);
  query.addEventListener("change", callback);
  return () => query.removeEventListener("change", callback);
}

function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeReducedMotion,
    () => window.matchMedia(REDUCED_QUERY).matches,
    () => false,
  );
}

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Il guscio comune alle finestre di sblocco e di creazione della master password: il velo che sfoca e scurisce la
 * pagina, il livello con `role="dialog"` (focus intrappolato, Esc se `dismissible`), e la fine dell'animazione di
 * uscita. Resta montato quando `phase` diventa "success" per il tempo dell'animazione della pelle scelta, poi chiama
 * `onDone`. Non sa nulla di password: chi lo usa gli dice solo in che fase è.
 */
export function DialogShell({
  style,
  phase,
  dismissible,
  label,
  leaveHref,
  onDismiss,
  onDone,
  children,
}: {
  style: UnlockStyle;
  phase: UnlockPhase;
  dismissible: boolean;
  label: string;
  /** Per una finestra che non si può chiudere: dove andare per lasciare la pagina che serve la chiave. */
  leaveHref?: string;
  onDismiss: () => void;
  onDone: () => void;
  children: ReactNode;
}) {
  const reduced = usePrefersReducedMotion();
  const layerRef = useRef<HTMLDivElement>(null);
  const [veilOn, setVeilOn] = useState(false);
  const success = phase === "success";

  // Gli ultimi riferimenti, così i timer e i tasti non ripartono a ogni render del chiamante.
  const onDoneRef = useRef(onDone);
  const onDismissRef = useRef(onDismiss);
  useEffect(() => {
    onDoneRef.current = onDone;
    onDismissRef.current = onDismiss;
  });

  // Il velo compare dopo il primo disegno, altrimenti la transizione non parte.
  useEffect(() => {
    const frame = requestAnimationFrame(() => requestAnimationFrame(() => setVeilOn(true)));
    return () => cancelAnimationFrame(frame);
  }, []);

  // Riuscito: il velo si dissolve piano e la finestra si chiude quando l'animazione è finita.
  useEffect(() => {
    if (!success) return;
    const fade = VEIL_FADE[style];
    const fadeTimer = setTimeout(() => setVeilOn(false), reduced ? 0 : fade.delayMs);
    const doneTimer = setTimeout(() => onDoneRef.current(), reduced ? REDUCED_EXIT_MS : UNLOCK_EXIT_MS[style]);
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(doneTimer);
    };
  }, [success, style, reduced]);

  // Con la tastiera su telefono la parte visibile si riduce: la finestra si centra lì e non nello schermo intero, dove
  // il browser la spingerebbe in alto per mostrare il campo. Misura la parte visibile (visualViewport) in variabili CSS.
  useEffect(() => {
    const layer = layerRef.current;
    const viewport = window.visualViewport;
    if (!layer || !viewport) return;
    function fit() {
      if (!layer || !viewport) return;
      layer.style.setProperty("--vv-top", `${viewport.offsetTop}px`);
      layer.style.setProperty("--vv-height", `${viewport.height}px`);
    }
    fit();
    viewport.addEventListener("resize", fit);
    viewport.addEventListener("scroll", fit);
    return () => {
      viewport.removeEventListener("resize", fit);
      viewport.removeEventListener("scroll", fit);
    };
  }, []);

  // Focus dentro la finestra: Tab non esce, Esc chiude (se si può), e alla chiusura il focus torna dov'era.
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const layer = layerRef.current;
    layer?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && dismissible && !success) {
        event.preventDefault();
        onDismissRef.current();
        return;
      }
      if (event.key !== "Tab" || !layer) return;
      const focusable = Array.from(layer.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null && getComputedStyle(el).visibility !== "hidden",
      );
      if (focusable.length === 0) {
        event.preventDefault();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && (active === first || active === layer)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      } else if (!layer.contains(active)) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      previous?.focus?.();
    };
  }, [dismissible, success]);

  const fade = VEIL_FADE[style];

  return createPortal(
    <div className={cn("unlock-root", reduced && "unlock-reduced")} data-style={style}>
      <div
        className="unlock-veil"
        data-on={veilOn}
        aria-hidden="true"
        style={
          success && !reduced
            ? { transition: `--unlock-blur ${fade.durationMs}ms ease, --unlock-dim ${fade.durationMs}ms ease` }
            : undefined
        }
      />
      <div ref={layerRef} className="unlock-layer" role="dialog" aria-modal="true" aria-label={label} tabIndex={-1}>
        <div className="flex flex-col items-center gap-3">
          {children}
          {leaveHref && !success ? (
            <Link href={leaveHref} className="unlock-leave">
              Torna alla dashboard
            </Link>
          ) : null}
        </div>
      </div>
    </div>,
    document.body,
  );
}
