"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface Slide {
  icon: string;
  title: string;
  description: string;
}

/** Una voce per ciascuna area principale dell'app --- stesse icone già usate nella navigazione/nelle sezioni, per coerenza visiva. */
const SLIDES: Slide[] = [
  {
    icon: "🔒",
    title: "I tuoi dati, solo tuoi",
    description:
      "Tutto è cifrato sul tuo dispositivo prima di lasciarlo: né Hinthial né chiunque altro può leggere i tuoi contenuti. Nemmeno la tua master password viaggia mai verso un server.",
  },
  {
    icon: "🗄️",
    title: "Un archivio per tutto",
    description:
      "Documenti, foto, audio, video e note testuali in un unico posto ordinato, con categorie, tag e scadenze --- niente più cartelle sparse tra email, telefono e cassetti.",
  },
  {
    icon: "🏠",
    title: "Asset e scadenze sotto controllo",
    description:
      "Censisci casa, veicoli, assicurazioni e contratti, collega i documenti che li riguardano e non perdere mai più una scadenza importante.",
  },
  {
    icon: "📦",
    title: "Capsule per le persone che contano",
    description:
      "Prepara messaggi e contenuti cifrati da lasciare a chi vuoi tu, quando conta davvero --- affidati a uno o più contatti fiduciari.",
  },
  {
    icon: "🤖",
    title: "Un assistente che resta sul tuo dispositivo",
    description:
      "Cerca e ritrova subito ciò che ti serve tra i tuoi contenuti: l'assistente lavora interamente in locale, senza che nulla lasci mai il tuo dispositivo.",
  },
];

const AUTOPLAY_INTERVAL_MS = 6000;

/**
 * Carosello di presentazione nella home page pubblica --- avanza da
 * solo ogni 6 secondi, in pausa al passaggio del mouse (per poter
 * leggere con calma) e disattivato del tutto per chi preferisce
 * meno animazioni (`prefers-reduced-motion`). Le frecce e i pallini
 * restano sempre disponibili per la navigazione manuale, che riparte
 * l'attesa dei 6 secondi da capo.
 */
export function LandingCarousel() {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const slide = SLIDES[index];

  useEffect(() => {
    // Legge una preferenza di sistema che non esiste ancora durante il
    // render lato server --- stesso pattern di lib/sidebar.ts.
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setReducedMotion(query.matches);
    function handleChange(event: MediaQueryListEvent) {
      setReducedMotion(event.matches);
    }
    query.addEventListener("change", handleChange);
    return () => query.removeEventListener("change", handleChange);
  }, []);

  useEffect(() => {
    if (paused || reducedMotion) return;
    const timer = window.setInterval(() => {
      setIndex((prev) => (prev + 1) % SLIDES.length);
    }, AUTOPLAY_INTERVAL_MS);
    return () => window.clearInterval(timer);
    // Ricreato ad ogni cambio di slide (anche manuale): l'attesa
    // riparte da capo invece di avanzare subito dopo un click.
  }, [index, paused, reducedMotion]);

  function goTo(next: number) {
    setIndex((next + SLIDES.length) % SLIDES.length);
  }

  return (
    <div
      role="region"
      aria-roledescription="carosello"
      aria-label="Cosa puoi fare con Hinthial"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      className="flex w-full max-w-2xl flex-col items-center gap-6"
    >
      <div className="flex w-full items-center gap-3 sm:gap-6">
        <button
          type="button"
          onClick={() => goTo(index - 1)}
          aria-label="Slide precedente"
          className="shrink-0 rounded-full border border-zinc-300 p-2 text-zinc-500 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-900"
        >
          <span aria-hidden="true">‹</span>
        </button>

        <div className="flex min-h-64 flex-1 flex-col items-center justify-center gap-3 rounded-xl border border-zinc-200 bg-white p-8 text-center dark:border-zinc-800 dark:bg-zinc-950">
          <span aria-hidden="true" className="text-5xl">
            {slide.icon}
          </span>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">{slide.title}</h2>
          <p className="max-w-md text-sm text-zinc-600 dark:text-zinc-400">{slide.description}</p>
        </div>

        <button
          type="button"
          onClick={() => goTo(index + 1)}
          aria-label="Slide successiva"
          className="shrink-0 rounded-full border border-zinc-300 p-2 text-zinc-500 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-900"
        >
          <span aria-hidden="true">›</span>
        </button>
      </div>

      <div className="flex gap-2">
        {SLIDES.map((s, i) => (
          <button
            key={s.title}
            type="button"
            onClick={() => goTo(i)}
            aria-label={`Vai alla slide ${i + 1}: ${s.title}`}
            aria-current={i === index}
            className={cn(
              "h-2 w-2 rounded-full transition-colors",
              i === index ? "bg-brand" : "bg-zinc-300 hover:bg-zinc-400 dark:bg-zinc-700 dark:hover:bg-zinc-600",
            )}
          />
        ))}
      </div>
    </div>
  );
}
