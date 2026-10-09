"use client";

import { useRef, useState } from "react";
import { ArchiveViewIcon } from "@/components/documents/archive/ArchiveViewIcon";
import { useArchiveView } from "@/components/documents/archive/useArchiveView";
import { ARCHIVE_VIEW_OPTIONS } from "@/lib/list-view";
import { cn } from "@/lib/utils";
import { useDismissOnOutside } from "@/lib/use-dismiss-on-outside";

/**
 * Il menu "Vista": cambia il modo di guardare l'Archivio. Scegliere una vista vale per questa visita (finisce
 * nell'indirizzo, il tasto indietro la annulla); "Rendi predefinita" la salva per ogni dispositivo, ed è la stessa
 * preferenza di Impostazioni > Aspetto.
 */
export function ArchiveViewSwitcher({ align = "right" }: { align?: "left" | "right" }) {
  const { view, defaultView, setView, makeDefault } = useArchiveView();
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useDismissOnOutside(rootRef, open, () => setOpen(false), { escape: true });

  const current = ARCHIVE_VIEW_OPTIONS.find((o) => o.value === view) ?? ARCHIVE_VIEW_OPTIONS[0];
  const defaultOption = ARCHIVE_VIEW_OPTIONS.find((o) => o.value === defaultView) ?? ARCHIVE_VIEW_OPTIONS[0];
  const isDefault = view === defaultView;

  async function handleMakeDefault() {
    setError(false);
    try {
      await makeDefault();
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch {
      setError(true);
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Vista: ${current.label}`}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold transition-colors",
          "border-zinc-300 bg-white text-zinc-800 hover:border-brand hover:bg-brand/5 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200",
        )}
      >
        <ArchiveViewIcon view={current.value} size={16} />
        <span>{current.label}</span>
        <span aria-hidden="true" className="text-xs opacity-70">
          {open ? "▴" : "▾"}
        </span>
      </button>

      {open ? (
        <div
          role="menu"
          aria-label="Vista dell'Archivio"
          className={cn(
            "absolute top-full z-30 mt-2 w-[19rem] overflow-hidden rounded-2xl border shadow-xl",
            align === "right" ? "right-0" : "left-0",
            "border-zinc-200 bg-white text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100",
          )}
        >
          <ul className="flex flex-col p-1.5">
            {ARCHIVE_VIEW_OPTIONS.map((option) => {
              const active = option.value === view;
              return (
                <li key={option.value}>
                  <button
                    type="button"
                    role="menuitemradio"
                    aria-checked={active}
                    onClick={() => {
                      setView(option.value);
                      setOpen(false);
                    }}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors",
                      active ? "bg-brand/10" : "hover:bg-zinc-100 dark:hover:bg-zinc-900",
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                        active ? "bg-brand text-white" : "bg-zinc-100 text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400",
                      )}
                    >
                      <ArchiveViewIcon view={option.value} size={17} />
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="text-sm font-semibold">{option.label}</span>
                      <span className="truncate text-xs text-zinc-500 dark:text-zinc-400">
                        {option.description}
                      </span>
                    </span>
                    {active ? (
                      <span aria-hidden="true" className="text-sm font-bold text-brand">
                        ✓
                      </span>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
          <div
            className={cn(
              "flex items-center justify-between gap-3 border-t px-4 py-2.5 text-xs",
              "border-zinc-200 text-zinc-500 dark:border-zinc-800 dark:text-zinc-400",
            )}
          >
            <span>
              Predefinita: <strong className="font-semibold">{defaultOption.label}</strong>
            </span>
            {isDefault ? (
              <span>{saved ? "Salvata ✓" : "Questa è la tua"}</span>
            ) : (
              <button type="button" onClick={handleMakeDefault} className="font-semibold text-brand underline-offset-2 hover:underline">
                Rendi predefinita
              </button>
            )}
          </div>
          {error ? (
            <p role="alert" className="border-t border-red-200 px-4 py-2 text-xs text-red-600 dark:border-red-900 dark:text-red-400">
              Non sono riuscito a salvarla. Riprova.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
