import Link from "next/link";
import { starterHref } from "@/domain/capsules/starter";
import { BTN_PRIMARY, BTN_SECONDARY } from "@/components/ui/styles";

/**
 * Barra a sé (v. feedback utente): Salva modifiche/Scarica/Elimina, stessa forma per tutti e tre (rounded-xl), sopra
 * al riquadro bianco con Anteprima e le tab --- non più dentro la tab Scheda.
 */
export function DocumentActionBar({
  documentId,
  isNote,
  dirty,
  saving,
  busy,
  onSave,
  onDownload,
  onDelete,
}: {
  documentId: string;
  isNote: boolean;
  dirty: boolean;
  saving: boolean;
  busy: boolean;
  onSave: () => void;
  onDownload: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        disabled={!dirty || saving}
        onClick={onSave}
        className={`${BTN_PRIMARY} disabled:opacity-50`}
      >
        {saving ? "Salvataggio…" : "Salva modifiche"}
      </button>
      {dirty && !saving ? (
        <span role="status" className="text-sm text-orange-700 dark:text-orange-400">
          Modifiche non salvate
        </span>
      ) : null}
      {isNote ? null : (
        <button
          type="button"
          disabled={busy}
          onClick={onDownload}
          className={`${BTN_SECONDARY} disabled:opacity-50`}
        >
          Scarica
        </button>
      )}
      <Link
        href={starterHref("documento", documentId)}
        className={BTN_SECONDARY}
      >
        Fallo arrivare a…
      </Link>
      <button
        type="button"
        disabled={busy}
        onClick={onDelete}
        className="rounded-xl border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 sm:ml-auto dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950"
      >
        Elimina
      </button>
    </div>
  );
}
