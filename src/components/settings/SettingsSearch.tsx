"use client";

import { useId, useState } from "react";
import { INPUT_FIELD } from "@/components/ui/styles";
import { cn } from "@/lib/utils";
import { searchSettings, type SettingsEntry, type SettingsTab } from "@/components/settings/settings-index";

/** Nome della pagina in cui sta il risultato, mostrato sotto: dice dove si va a finire. */
export function SettingsSearch({
  tabLabels,
  onSelect,
  className,
}: {
  tabLabels: Record<SettingsTab, string>;
  onSelect: (entry: SettingsEntry) => void;
  className?: string;
}) {
  const [query, setQuery] = useState("");
  const listId = useId();
  const results = searchSettings(query).slice(0, 6);
  const searching = query.trim() !== "";

  return (
    <div className={cn("flex flex-col gap-2", className)} role="search">
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Cerca nelle impostazioni"
        aria-label="Cerca nelle impostazioni"
        aria-controls={listId}
        className={cn(INPUT_FIELD, "w-full")}
      />
      {searching ? (
        results.length > 0 ? (
          <ul id={listId} className="flex flex-col divide-y divide-zinc-200 rounded-card border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-950">
            {results.map((entry) => (
              <li key={`${entry.tab}/${entry.block}`}>
                <button
                  type="button"
                  onClick={() => {
                    onSelect(entry);
                    setQuery("");
                  }}
                  className="flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left hover:bg-brand/10"
                >
                  <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{entry.label}</span>
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">{tabLabels[entry.tab]}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p id={listId} role="status" className="px-1 text-sm text-zinc-500 dark:text-zinc-400">
            Nessun risultato per &laquo;{query.trim()}&raquo;.
          </p>
        )
      ) : null}
    </div>
  );
}
