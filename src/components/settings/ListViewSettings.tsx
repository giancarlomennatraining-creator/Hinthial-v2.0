"use client";

import { useState } from "react";
import { ListViewToggle } from "@/components/ui/ListViewToggle";
import { useListViewPreferences } from "@/components/layout/ListViewPreferencesProvider";
import {
  ARCHIVE_VIEW_OPTIONS,
  isArchiveViewMode,
  LIST_SECTIONS,
  LIST_SECTION_LABEL,
} from "@/lib/list-view";

/** La vista con cui si apre l'Archivio: una delle sei. Si può comunque cambiare dal menu "Vista" nella pagina, per quella visita. */
function ArchiveDefaultView() {
  const { savedArchiveView, setArchiveView, loading } = useListViewPreferences();
  const [error, setError] = useState(false);
  const current = ARCHIVE_VIEW_OPTIONS.find((o) => o.value === savedArchiveView);

  async function handleChange(value: string) {
    if (!isArchiveViewMode(value)) return;
    setError(false);
    try {
      await setArchiveView(value);
    } catch {
      setError(true);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <select
        value={savedArchiveView}
        disabled={loading}
        onChange={(e) => void handleChange(e.target.value)}
        aria-label="Vista predefinita dell'Archivio"
        className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-950 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
      >
        {ARCHIVE_VIEW_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <span className="text-xs text-zinc-500 dark:text-zinc-400">{current?.description}</span>
      {error ? (
        <span role="alert" className="text-xs text-red-600 dark:text-red-400">
          Non sono riuscito a salvare la scelta.
        </span>
      ) : null}
    </div>
  );
}

/** Impostazioni -> Aspetto: un interruttore elenco/tabella per ogni sezione con liste --- lo stesso di ListViewToggle usato in ogni sezione, quindi sempre sincronizzato con esso. L'Archivio ha sei viste e un menu a tendina. */
export function ListViewSettings() {
  return (
    <ul className="flex flex-col divide-y divide-zinc-200 rounded-2xl border border-zinc-200 bg-white shadow-[0_8px_20px_rgba(16,24,40,0.04)] dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-950">
      {LIST_SECTIONS.map((section) => (
        <li key={section} className={`flex justify-between gap-4 p-3 ${section === "archive" ? "items-start" : "items-center"}`}>
          <span className={`text-sm text-zinc-700 dark:text-zinc-300 ${section === "archive" ? "pt-1.5" : ""}`}>
            {LIST_SECTION_LABEL[section]}
          </span>
          {section === "archive" ? <ArchiveDefaultView /> : <ListViewToggle section={section} />}
        </li>
      ))}
    </ul>
  );
}
