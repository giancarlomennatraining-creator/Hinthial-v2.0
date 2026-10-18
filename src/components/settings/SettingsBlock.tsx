"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Il blocco delle Impostazioni da raggiungere (da una ricerca o da un link come `?tab=activity`): il blocco con quell'`id`
 * si apre, se è richiudibile, e si porta in vista. `n` cambia a ogni richiesta, così si può chiedere due volte lo stesso.
 */
export const SettingsFocusContext = createContext<{ block: string | null; n: number }>({ block: null, n: 0 });

/**
 * Un blocco di una pagina delle Impostazioni: a sinistra cosa è e a cosa serve, a destra i comandi. Prima ogni pagina era
 * una colonna di titoli e moduli tutti uguali; così ogni blocco si riconosce al primo sguardo e si salta con l'occhio.
 * I blocchi lunghi (il registro delle attività, importa/esporta) si aprono solo quando servono.
 */
export function SettingsBlock({
  id,
  title,
  description,
  collapsible,
  danger,
  children,
}: {
  id: string;
  title: string;
  description?: ReactNode;
  /** Chiuso finché non lo apri: per i blocchi lunghi, che da aperti farebbero sparire gli altri. */
  collapsible?: boolean;
  danger?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(!collapsible);
  const ref = useRef<HTMLElement>(null);
  const focus = useContext(SettingsFocusContext);
  const headingId = `settings-block-${id}`;

  // Una richiesta nuova per questo blocco lo apre (durante il render, non in un effetto: così il suo contenuto compare subito).
  const requested = focus.block === id ? focus.n : -1;
  const [handled, setHandled] = useState(-1);
  if (requested !== handled) {
    setHandled(requested);
    if (requested >= 0) setOpen(true);
  }

  useEffect(() => {
    if (requested < 0) return;
    // Dopo che il blocco ha avuto il tempo di aprirsi e di disporsi.
    const frame = requestAnimationFrame(() => ref.current?.scrollIntoView({ block: "start", behavior: "smooth" }));
    return () => cancelAnimationFrame(frame);
  }, [requested]);

  return (
    <section
      ref={ref}
      id={headingId}
      aria-labelledby={`${headingId}-title`}
      className="grid scroll-mt-24 grid-cols-1 gap-x-10 gap-y-4 border-t border-zinc-200 py-8 first:border-t-0 first:pt-0 @2xl:grid-cols-[13rem_minmax(0,1fr)] dark:border-zinc-800"
    >
      <div className="flex flex-col items-start gap-2">
        <h2
          id={`${headingId}-title`}
          className={cn(
            "text-base font-semibold",
            danger ? "text-red-700 dark:text-red-400" : "text-zinc-900 dark:text-zinc-100",
          )}
        >
          {title}
        </h2>
        {description ? <p className="text-sm text-zinc-500 dark:text-zinc-400">{description}</p> : null}
        {collapsible ? (
          <button
            type="button"
            aria-expanded={open}
            aria-controls={`${headingId}-body`}
            onClick={() => setOpen((o) => !o)}
            className="rounded-btn border border-zinc-300 px-3 py-1.5 text-sm font-medium text-accent hover:bg-brand/10 dark:border-zinc-700"
          >
            {open ? "Chiudi" : "Apri"}
            <span className="sr-only"> {title}</span>
          </button>
        ) : null}
      </div>
      {open ? (
        <div id={`${headingId}-body`} className="min-w-0">
          {children}
        </div>
      ) : null}
    </section>
  );
}
