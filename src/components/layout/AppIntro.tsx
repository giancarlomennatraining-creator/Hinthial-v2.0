"use client";

import { useEffect } from "react";
import { INTRO_DURATION_MS, INTRO_SEEN_KEY } from "@/lib/app-intro";
import { startIntroSound } from "@/lib/intro-sound";
import "./app-intro.css";

/**
 * Il velo dell'entrata "Aurora" (v. lib/app-intro.ts). Il markup c'è sempre nella pagina ma resta nascosto: lo mostra
 * lo script iniziale (`data-intro` sull'elemento radice) prima del primo paint, e le animazioni sono tutte CSS, quindi
 * si chiude da sé dopo 3,5 secondi anche se questo componente non arrivasse a funzionare. Qui restano solo il
 * ricordo che è stata vista, il suono e il tocco che la salta.
 */
export function AppIntro() {
  useEffect(() => {
    const root = document.documentElement;
    if (root.getAttribute("data-intro") !== "1") return;

    // Ricordata subito, non alla fine: se l'app viene chiusa a metà non deve ripartire a ogni apertura.
    try {
      window.localStorage.setItem(INTRO_SEEN_KEY, "1");
    } catch {
      // Senza memoria del browser tornerebbe a ogni apertura: meglio comunque di non mostrarla mai.
    }

    let sound: { stop: () => void } | null = null;
    let cancelled = false;
    void startIntroSound().then((started) => {
      if (cancelled) started?.stop();
      else sound = started;
    });

    const velo = document.getElementById("app-intro");
    function finish() {
      root.removeAttribute("data-intro");
    }
    const timer = window.setTimeout(finish, INTRO_DURATION_MS + 100);

    // Un tocco la salta: dissolvenza rapida e suono spento.
    function skip() {
      velo?.classList.add("ai-skip");
      sound?.stop();
      window.clearTimeout(timer);
      window.setTimeout(finish, 280);
    }
    velo?.addEventListener("pointerdown", skip, { once: true });

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      sound?.stop();
      velo?.removeEventListener("pointerdown", skip);
    };
  }, []);

  return (
    <div id="app-intro" className="ai-root" aria-hidden="true">
      <div className="ai-base" />
      <div className="ai-blob ai-b1" />
      <div className="ai-blob ai-b2" />
      <div className="ai-blob ai-b3" />
      <div className="ai-blob ai-b4" />
      <div className="ai-grain" />
      <div className="ai-stage">
        <div className="ai-mark">
          <div className="ai-halo" />
          <div className="ai-logo" />
          <div className="ai-flare" />
        </div>
        <div className="ai-wm">
          <div className="ai-plate" />
          <div className="ai-wordmark" />
          <div className="ai-shine" />
        </div>
      </div>
    </div>
  );
}
