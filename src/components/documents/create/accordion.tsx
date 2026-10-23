"use client";

import { useEffect, useState } from "react";
import { PANEL } from "@/components/ui/styles";

export type StepState = "active" | "done" | "todo";

/** Il segno di spunta del passo completato --- il tratto si disegna (v. .step-check-path in globals.css). */
function StepCheck() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      aria-hidden="true"
    >
      <path
        className="step-check-path"
        d="M5 12.5l4.5 4.5L19 7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** La scheda unica che contiene tutti i passi: le linee tra i cerchi la attraversano da un passo al successivo. */
export function AccordionCard({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${PANEL} overflow-hidden`}>
      {children}
    </div>
  );
}

/**
 * Il momento "salvato" tra i Dettagli e i passi di Hinthial: si apre, mostra il cerchio verde con l'anello che si
 * espande, poi si ripiega (`open` torna false) lasciando il posto al passo successivo.
 */
export function SavedMoment({ open }: { open: boolean }) {
  return (
    <div className="step-body" data-open={open ? "true" : "false"}>
      <div className="step-inner" inert={!open}>
        <div
          role="status"
          className="flex items-center gap-3 px-5 py-3.5 text-sm font-semibold text-emerald-600 dark:text-emerald-400"
        >
          <span className="saved-pop relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white">
            <span
              aria-hidden="true"
              className="saved-ring absolute inset-0 rounded-full border-2 border-emerald-500"
            />
            <StepCheck />
          </span>
          Salvato e cifrato sul tuo dispositivo
        </div>
      </div>
    </div>
  );
}

/**
 * Concept A "Fisarmonica fluida" (v. Artifact discusso con l'utente): un passo alla volta, il completato si riduce
 * a un riepilogo con "Modifica" e il cerchio diventa una spunta verde, il successivo si apre in modo fluido.
 * `locked`: il passo è già stato salvato, si vede ma non si riapre. `separator`: una riga di testo prima del passo.
 */
export function AccordionStep({
  step,
  state,
  locked = false,
  last = false,
  title,
  summary,
  separator,
  onOpen,
  children,
}: {
  step: number;
  state: StepState;
  locked?: boolean;
  last?: boolean;
  title: string;
  summary?: React.ReactNode;
  separator?: string;
  onOpen: () => void;
  children: React.ReactNode;
}) {
  const active = state === "active";
  // Il contenuto resta montato per la durata della chiusura, altrimenti sparirebbe di colpo invece di ripiegarsi.
  const [mounted, setMounted] = useState(active);
  if (active && !mounted) setMounted(true);
  useEffect(() => {
    if (active) return;
    const id = setTimeout(() => setMounted(false), 650);
    return () => clearTimeout(id);
  }, [active]);

  return (
    <>
      {separator ? (
        <div className="mx-5 my-2 flex items-center gap-3 text-xs font-medium text-zinc-500 sm:ml-[3.75rem] dark:text-zinc-400">
          <span className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
          <span>{separator}</span>
          <span className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
        </div>
      ) : null}
      <div className="relative">
        {last ? null : (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute top-[46px] -bottom-3 left-[33px] hidden w-0.5 rounded bg-zinc-200 sm:block dark:bg-zinc-800"
          >
            <span
              className="step-line-fill block h-full w-full bg-emerald-500"
              data-done={state === "done" ? "true" : "false"}
            />
          </span>
        )}
        <button
          type="button"
          onClick={onOpen}
          disabled={locked}
          aria-expanded={active}
          className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left disabled:cursor-default"
        >
          <span className="flex min-w-0 items-center gap-3">
            <span
              className={
                state === "active"
                  ? "flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand text-sm font-bold text-white"
                  : state === "done"
                    ? "flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white"
                    : "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-zinc-300 text-sm font-bold text-zinc-500 dark:border-zinc-700 dark:text-zinc-500"
              }
            >
              {state === "done" ? <StepCheck /> : step}
            </span>
            <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              {title}
            </span>
          </span>
          {active || !summary ? null : (
            <span className="flex min-w-0 items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
              <span className="truncate">{summary}</span>
              {locked || state === "todo" ? null : (
                <span className="shrink-0 font-semibold text-accent">
                  Modifica
                </span>
              )}
            </span>
          )}
        </button>
        <div className="step-body" data-open={active ? "true" : "false"}>
          <div className="step-inner" inert={!active}>
            {mounted ? (
              // pt-1.5: .step-inner nasconde ciò che esce dai bordi (serve all'animazione di apertura), e senza un margine in
              // alto il contorno di "elemento attivo" del primo campo (es. il riquadro di caricamento) veniva tagliato.
              <div className="flex flex-col gap-4 px-5 pt-1.5 pb-5 sm:pl-[3.75rem]">
                {children}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </>
  );
}
