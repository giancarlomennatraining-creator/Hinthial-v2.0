import type { UndoableAction } from "@/components/documents/ReadingRegister";

/** Scheda / Letto dal dispositivo / Chiedi a Silva: le tre tab della colonna a destra. */
export type DocumentTab = "scheda" | "reading" | "analysis";

/**
 * Le tab. "Proposte" non esiste più come tab a sé (v. feedback utente): quello che c'è da accettare vive già dentro
 * una delle due letture, secondo la fonte. Scheda è la prima tab, non più fissa a sinistra.
 */
export function DocumentTabList({
  active,
  onChange,
  proposalCount,
}: {
  active: DocumentTab;
  onChange: (tab: DocumentTab) => void;
  proposalCount: number;
}) {
  const tabs: { id: DocumentTab; label: string }[] = [
    { id: "scheda", label: "Scheda" },
    { id: "reading", label: "Letto dal dispositivo" },
    { id: "analysis", label: `Chiedi a Silva${proposalCount > 0 ? ` · ${proposalCount}` : ""}` },
  ];

  return (
    <div role="tablist" className="flex gap-1 overflow-x-auto border-b border-zinc-200 [scrollbar-width:none] dark:border-zinc-800 [&::-webkit-scrollbar]:hidden">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          id={`tab-${tab.id}`}
          aria-selected={active === tab.id}
          aria-controls={`tabpanel-${tab.id}`}
          onClick={() => onChange(tab.id)}
          className={`shrink-0 rounded-t-md px-3 py-2 text-sm font-medium whitespace-nowrap ${
            active === tab.id
              ? "border-b-2 border-brand text-accent"
              : "text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

/**
 * L'annullamento resta visibile a cambio tab: una sola istanza sopra i pannelli, non una per tab. aria-label distinto
 * dal toast globale (v. ToastProvider): entrambi sono role="status".
 */
export function UndoableStatus({ undoable }: { undoable: UndoableAction }) {
  return (
    <div
      role="status"
      aria-label="Ultima proposta"
      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-brand/20 bg-brand/5 px-3 py-2 text-sm text-zinc-700 dark:text-zinc-300"
    >
      <span>{undoable.message}</span>
      <button
        type="button"
        onClick={undoable.onUndo}
        className="font-medium text-accent underline-offset-2 hover:underline"
      >
        Annulla
      </button>
    </div>
  );
}
