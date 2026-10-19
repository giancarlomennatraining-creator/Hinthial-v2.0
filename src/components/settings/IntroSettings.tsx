"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import {
  INTRO_MODE_KEY,
  INTRO_MODE_LABEL,
  INTRO_PLAY_EVENT,
  INTRO_SOUND_KEY,
  parseIntroMode,
  type IntroMode,
} from "@/lib/app-intro";

const MODES: IntroMode[] = ["always", "first", "never"];

/**
 * Impostazioni -> Aspetto e preferenze -> Entrata dell'app. Le scelte stanno sul dispositivo (come lo stile): quando mostrarla,
 * con o senza suono, e un pulsante per rivederla subito. La decisione vera la prende lo script iniziale (v. lib/app-intro.ts).
 */
export function IntroSettings() {
  const [mode, setMode] = useState<IntroMode>("always");
  const [sound, setSound] = useState(true);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- legge preferenze già decise altrove (localStorage, sistema), non deriva stato da props/state React. */
    try {
      setMode(parseIntroMode(window.localStorage.getItem(INTRO_MODE_KEY)));
      setSound(window.localStorage.getItem(INTRO_SOUND_KEY) !== "off");
    } catch {
      // Senza memoria del browser restano i valori di partenza.
    }
    setReduced(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  function changeMode(next: IntroMode) {
    setMode(next);
    try {
      window.localStorage.setItem(INTRO_MODE_KEY, next);
    } catch {
      // Vale solo finché la pagina resta aperta.
    }
  }

  function changeSound(next: boolean) {
    setSound(next);
    try {
      window.localStorage.setItem(INTRO_SOUND_KEY, next ? "on" : "off");
    } catch {
      // Vale solo finché la pagina resta aperta.
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div
        role="radiogroup"
        aria-label="Quando mostrare l'entrata"
        className="inline-flex flex-wrap self-start rounded-md border border-zinc-300 p-1 dark:border-zinc-700"
      >
        {MODES.map((value) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={mode === value}
            onClick={() => changeMode(value)}
            className={cn(
              "rounded px-3 py-1.5 text-sm font-medium transition-colors",
              mode === value
                ? "bg-brand text-white"
                : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900",
            )}
          >
            {INTRO_MODE_LABEL[value]}
          </button>
        ))}
      </div>

      <label className="flex items-center gap-3 text-sm text-zinc-700 dark:text-zinc-300">
        <input
          type="checkbox"
          checked={sound}
          onChange={(e) => changeSound(e.target.checked)}
          className="h-4 w-4 shrink-0 accent-brand"
        />
        Con il suono
      </label>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={reduced}
          onClick={() => window.dispatchEvent(new Event(INTRO_PLAY_EVENT))}
          className="rounded-btn border border-zinc-300 px-4 py-2 text-sm font-medium text-accent hover:bg-brand/10 disabled:opacity-50 dark:border-zinc-700"
        >
          Rivedila ora
        </button>
        <p className="min-w-0 text-xs text-zinc-500 dark:text-zinc-400">
          {reduced
            ? "Hai chiesto meno movimento al telefono: l'entrata resta spenta."
            : "Compare solo quando apri l'app installata sul telefono. A ogni apertura vuol dire ogni volta che la riapri da chiusa, non quando ci torni da un'altra app."}
        </p>
      </div>
    </div>
  );
}
