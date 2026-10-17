"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { applyStyle, getStoredStylePreference, storeStylePreference, type StylePreference } from "@/lib/theme";

/**
 * Le anteprime sono dati di esempio, non colori dell'app: ogni stile mostra il proprio sfondo e il proprio accento in
 * chiaro e in scuro, qualunque sia lo stile attivo adesso. Per questo sono esadecimali qui, e vanno tenuti allineati ai
 * gettoni di globals.css (`--background` e `--brand` di ciascuno stile).
 */
const OPTIONS: {
  value: StylePreference;
  label: string;
  description: string;
  swatch: { lightBg: string; lightAccent: string; darkBg: string; darkAccent: string };
}[] = [
  {
    value: "foglia",
    label: "Foglia",
    description: "Verde foglia e blu inchiostro, toni caldi.",
    swatch: { lightBg: "#edf4ee", lightAccent: "#1d7a4a", darkBg: "#0c1a18", darkAccent: "#6fd79a" },
  },
  {
    value: "notte",
    label: "Notte",
    description: "Blu notte con accenti azzurri, come la home.",
    swatch: { lightBg: "#eaf2fb", lightAccent: "#1b4fd0", darkBg: "#07112e", darkAccent: "#8fb0ff" },
  },
  {
    value: "luce",
    label: "Luce",
    description: "Bianco e blu sobrio, il più neutro.",
    swatch: { lightBg: "#fbfbfd", lightAccent: "#1f46c8", darkBg: "#101426", darkAccent: "#9bb2ff" },
  },
];

/** Impostazioni → Aspetto → Tema. Indipendente da chiaro/scuro/sistema (v. ThemeToggle). Lo stile effettivo è già applicato prima del primo paint da uno script inline (v. app/layout.tsx); qui si riflette e si cambia. */
export function StyleToggle() {
  const [style, setStyle] = useState<StylePreference>("foglia");

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- legge una preferenza già decisa altrove (localStorage), non deriva stato da props/state React.
    setStyle(getStoredStylePreference());
  }, []);

  function handleChange(next: StylePreference) {
    setStyle(next);
    storeStylePreference(next);
    applyStyle(next);
  }

  return (
    <div role="radiogroup" aria-label="Stile" className="grid gap-3 sm:grid-cols-3">
      {OPTIONS.map((option) => {
        const selected = style === option.value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => handleChange(option.value)}
            className={cn(
              "flex flex-col gap-3 rounded-card border p-3 text-left transition-colors",
              selected
                ? "border-brand bg-brand/10 ring-1 ring-brand"
                : "border-zinc-200 bg-white hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-700",
            )}
          >
            <span aria-hidden="true" className="flex h-12 overflow-hidden rounded-xl border border-black/10">
              <span className="flex flex-1 items-end p-1.5" style={{ background: option.swatch.lightBg }}>
                <span className="h-3 w-8 rounded-full" style={{ background: option.swatch.lightAccent }} />
              </span>
              <span className="flex flex-1 items-end justify-end p-1.5" style={{ background: option.swatch.darkBg }}>
                <span className="h-3 w-8 rounded-full" style={{ background: option.swatch.darkAccent }} />
              </span>
            </span>
            <span className="flex flex-col gap-0.5">
              <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{option.label}</span>
              <span className="text-xs text-zinc-600 dark:text-zinc-400">{option.description}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
