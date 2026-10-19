"use client";

import type { ArchiveView } from "@/domain/documents/archive-overview";
import { cn } from "@/lib/utils";

const VIEWS: { id: ArchiveView; label: string }[] = [
  { id: "panoramica", label: "Panoramica" },
  { id: "schede", label: "Schede" },
  { id: "elenco", label: "Elenco" },
];

/** La scelta della vista dell'Archivio: tre voci affiancate, quella attiva evidenziata. Resta sul dispositivo. */
export function ArchiveViewSwitcher({ view, onChange }: { view: ArchiveView; onChange: (next: ArchiveView) => void }) {
  return (
    <div
      role="radiogroup"
      aria-label="Vista dell'archivio"
      className="inline-flex self-start rounded-full border border-zinc-200 bg-white p-1 dark:border-zinc-800 dark:bg-zinc-950"
    >
      {VIEWS.map((v) => (
        <button
          key={v.id}
          type="button"
          role="radio"
          aria-checked={view === v.id}
          onClick={() => onChange(v.id)}
          className={cn(
            "rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors",
            view === v.id ? "bg-brand text-white" : "text-zinc-600 hover:bg-brand/10 hover:text-accent dark:text-zinc-400",
          )}
        >
          {v.label}
        </button>
      ))}
    </div>
  );
}
