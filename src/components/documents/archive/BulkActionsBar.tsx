"use client";

import { sortAlphabetically } from "@/lib/utils";
import type { ArchiveData } from "@/components/documents/archive/useArchiveData";

const CHIP =
  "rounded-[10px] bg-white/12 px-3 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-white/20 disabled:opacity-50";

/**
 * La barra delle azioni sui documenti selezionati, per le viste a schede: una pillola scura in basso, al centro. Le
 * stesse azioni dell'elenco (categoria, tag, fascicolo, cestino) con gli stessi controlli, qui con i menu che si aprono
 * verso l'alto.
 */
export function BulkActionsBar({ data }: { data: ArchiveData }) {
  const {
    selectedIds,
    clearSelection,
    bulkBusy,
    bulkPopover,
    setBulkPopover,
    bulkTagInput,
    setBulkTagInput,
    categories,
    dossiers,
    handleBulkCategory,
    handleBulkTag,
    handleBulkDossier,
    handleBulkDelete,
  } = data;

  if (selectedIds.size === 0) return null;
  const count = selectedIds.size;

  return (
    <div
      role="toolbar"
      aria-label="Azioni sui documenti selezionati"
      className="fixed bottom-6 left-1/2 z-40 flex max-w-[calc(100vw-2rem)] -translate-x-1/2 flex-wrap items-center gap-1.5 rounded-2xl bg-[#121a35] py-2 pr-2.5 pl-[18px] text-white shadow-[0_18px_40px_rgba(18,26,53,0.35)]"
    >
      <span className="pr-2.5 text-sm font-bold">
        {count} {count === 1 ? "selezionato" : "selezionati"}
      </span>

      <div className="relative">
        <button
          type="button"
          disabled={bulkBusy}
          onClick={() => setBulkPopover(bulkPopover === "category" ? null : "category")}
          className={CHIP}
        >
          Categoria
        </button>
        {bulkPopover === "category" ? (
          <div className="absolute bottom-full left-0 z-50 mb-2 max-h-64 w-56 overflow-y-auto rounded-xl border border-zinc-200 bg-white p-1.5 text-zinc-700 shadow-lg dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300">
            {sortAlphabetically(categories, (c) => c.name).map((category) => (
              <button
                key={category.id}
                type="button"
                onClick={() => handleBulkCategory(category.id)}
                className="block w-full rounded-md px-2.5 py-1.5 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-900"
              >
                {category.icon} {category.name}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div className="relative">
        <button
          type="button"
          disabled={bulkBusy || dossiers.length === 0}
          onClick={() => setBulkPopover(bulkPopover === "dossier" ? null : "dossier")}
          className={CHIP}
        >
          Fascicolo
        </button>
        {bulkPopover === "dossier" ? (
          <div className="absolute bottom-full left-0 z-50 mb-2 max-h-64 w-56 overflow-y-auto rounded-xl border border-zinc-200 bg-white p-1.5 text-zinc-700 shadow-lg dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300">
            {dossiers.map((dossier) => (
              <button
                key={dossier.id}
                type="button"
                onClick={() => handleBulkDossier(dossier.id)}
                className="block w-full truncate rounded-md px-2.5 py-1.5 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-900"
              >
                {dossier.title}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div className="relative">
        <button
          type="button"
          disabled={bulkBusy}
          onClick={() => setBulkPopover(bulkPopover === "tag" ? null : "tag")}
          className={CHIP}
        >
          Tag
        </button>
        {bulkPopover === "tag" ? (
          <div className="absolute bottom-full left-0 z-50 mb-2 w-56 rounded-xl border border-zinc-200 bg-white p-3 text-zinc-700 shadow-lg dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300">
            <label className="mb-1.5 block text-xs text-zinc-500 dark:text-zinc-400">Aggiungi un tag a tutti i selezionati</label>
            <input
              type="text"
              value={bulkTagInput}
              onChange={(e) => setBulkTagInput(e.target.value)}
              placeholder="es. urgente"
              aria-label="Nuovo tag per i documenti selezionati"
              className="mb-2 w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-950 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
            />
            <button
              type="button"
              disabled={!bulkTagInput.trim()}
              onClick={() => handleBulkTag(bulkTagInput)}
              className="w-full rounded-md bg-brand px-2 py-1.5 text-sm font-medium text-white hover:bg-brand-hover disabled:opacity-50"
            >
              Aggiungi
            </button>
          </div>
        ) : null}
      </div>

      <button
        type="button"
        disabled={bulkBusy}
        onClick={handleBulkDelete}
        className="rounded-[10px] bg-[#c0392b] px-3 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-[#a93226] disabled:opacity-50"
      >
        Cestino
      </button>
      <button
        type="button"
        onClick={clearSelection}
        aria-label="Deseleziona tutto"
        className="flex h-8 w-8 items-center justify-center rounded-[10px] text-white transition-colors hover:bg-white/15"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  );
}
