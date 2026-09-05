"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { useNavOrientation } from "@/components/layout/NavOrientationProvider";
import { NAV_ORIENTATIONS, NAV_ORIENTATION_LABEL, type NavOrientation } from "@/lib/nav-orientation";

/** Impostazioni -> Aspetto: sceglie la disposizione del menu di navigazione --- sincronizzata sul server (v. NavOrientationProvider), applicata subito a tutta la shell. */
export function NavOrientationSettings() {
  const { orientation, setOrientation } = useNavOrientation();
  const [error, setError] = useState(false);

  async function handleChange(next: NavOrientation) {
    setError(false);
    try {
      await setOrientation(next);
    } catch {
      setError(true);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div
        role="radiogroup"
        aria-label="Disposizione del menu"
        className="inline-flex flex-col gap-1 rounded-md border border-zinc-300 p-1 dark:border-zinc-700 sm:inline-flex sm:flex-row"
      >
        {NAV_ORIENTATIONS.map((option) => (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={orientation === option}
            onClick={() => handleChange(option)}
            className={cn(
              "rounded px-3 py-1.5 text-sm font-medium transition-colors",
              orientation === option
                ? "bg-brand text-white"
                : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900",
            )}
          >
            {NAV_ORIENTATION_LABEL[option]}
          </button>
        ))}
      </div>
      {error ? (
        <p role="alert" className="text-xs text-red-600 dark:text-red-400">
          Preferenza non salvata.
        </p>
      ) : null}
    </div>
  );
}
