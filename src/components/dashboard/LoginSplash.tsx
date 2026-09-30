"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Il benvenuto dopo il login: solo il wordmark, una barra che si riempie in circa 3 secondi, poi un fade che
 * rivela la Dashboard sotto (già montata, non un secondo caricamento) --- mostrato una volta sola, subito dopo
 * signIn/signUp/verifyMfaCode (v. auth/actions.ts, "?justLoggedIn=1"), mai alle visite successive della Dashboard
 * nella stessa sessione (v. DashboardPanel.tsx, che toglie subito il parametro dall'URL).
 *
 * Le due durate (qui sotto, e la keyframe login-splash-fill in globals.css) sono la stessa cosa scritta in due
 * punti diversi: cambiarne una senza l'altra sfasa la barra dal momento in cui scatta il fade.
 */
const LOADING_MS = 3000;
const FADE_MS = 500;

export function LoginSplash({ onDone }: { onDone: () => void }) {
  const [phase, setPhase] = useState<"loading" | "fading">("loading");

  useEffect(() => {
    const timer = setTimeout(() => setPhase("fading"), LOADING_MS);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (phase !== "fading") return;
    const timer = setTimeout(onDone, FADE_MS);
    return () => clearTimeout(timer);
  }, [phase, onDone]);

  return (
    <div
      role="status"
      aria-label="Accesso in corso"
      className={cn(
        "fixed inset-0 z-50 flex flex-col items-center justify-center gap-7 bg-background transition-opacity duration-500 ease-out",
        phase === "fading" ? "pointer-events-none opacity-0" : "opacity-100",
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- brand asset (SVG), non contenuto utente */}
      <img src="/brand/wordmark.svg" alt="Hinthial" className="h-auto w-[280px]" />
      <div className="h-1 w-56 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
        <div className="login-splash-bar h-full rounded-full bg-brand" />
      </div>
    </div>
  );
}
