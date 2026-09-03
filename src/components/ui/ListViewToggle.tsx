"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { useListViewPreferences } from "@/components/layout/ListViewPreferencesProvider";
import type { ListSection, ListViewMode } from "@/lib/list-view";

const OPTIONS: { value: ListViewMode; label: string; icon: string }[] = [
  { value: "list", label: "Vista a elenco", icon: "☰" },
  { value: "table", label: "Vista a tabella", icon: "▦" },
];

/**
 * Interruttore rapido elenco/tabella per una sezione --- riflette e
 * cambia la stessa preferenza gestita in Impostazioni > Aspetto (v.
 * ListViewPreferencesProvider), quindi resta sempre sincronizzato con
 * essa senza bisogno di ricaricare la pagina.
 */
export function ListViewToggle({ section }: { section: ListSection }) {
  const { modeFor, setMode, loading } = useListViewPreferences();
  const [error, setError] = useState(false);
  const mode = modeFor(section);

  async function handleChange(next: ListViewMode) {
    setError(false);
    try {
      await setMode(section, next);
    } catch {
      setError(true);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <div
        role="radiogroup"
        aria-label="Modalità di visualizzazione"
        className="inline-flex shrink-0 rounded-md border border-zinc-300 p-1 dark:border-zinc-700"
      >
        {OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={mode === option.value}
            aria-label={option.label}
            title={option.label}
            disabled={loading}
            onClick={() => handleChange(option.value)}
            className={cn(
              "rounded px-2.5 py-1.5 text-sm transition-colors disabled:opacity-50",
              mode === option.value
                ? "bg-brand text-white"
                : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900",
            )}
          >
            <span aria-hidden="true">{option.icon}</span>
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
