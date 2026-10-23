import { readingStateFor } from "@/domain/extraction/reading-state";
import { formatDate } from "@/lib/format";
import { Spinner } from "@/components/ui/Spinner";
import { PANEL } from "@/components/ui/styles";
import type { DocumentListItem } from "@/domain/documents/types";

/** Quanti caratteri del testo letto si mostrano prima di "Mostra tutto". */
const TEXT_PREVIEW_CHARS = 1200;

/** "Cosa ho letto" --- unico posto dove i quattro stati di lettura (v. domain/extraction/reading-state.ts) diventano leggibili invece che dedotti. */
export function ReadingSection({
  doc,
  reading,
  rereading,
  fullText,
  onToggleFullText,
  onReread,
}: {
  doc: DocumentListItem;
  reading: ReturnType<typeof readingStateFor>;
  rereading: number | null;
  fullText: boolean;
  onToggleFullText: () => void;
  onReread: () => void;
}) {
  // Per una nota il testo È il contenuto: l'anteprima lo mostra già per intero.
  if (reading === "own-text") return null;

  const busy = rereading !== null;
  const rereadLabel = busy
    ? `Lettura… ${Math.round((rereading ?? 0) * 100)}%`
    : reading === "never"
      ? "Leggilo ora"
      : "Rileggi";

  const tooLong = doc.extractedText.length > TEXT_PREVIEW_CHARS;
  const shown =
    fullText || !tooLong ? doc.extractedText : doc.extractedText.slice(0, TEXT_PREVIEW_CHARS);

  return (
    <section aria-label="Cosa ho letto" className={`${PANEL} flex flex-col gap-3 p-4`}>
      <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Cosa ho letto</h2>

      {reading === "cannot" ? (
        <>
          <p className="text-sm text-zinc-700 dark:text-zinc-300">
            Non so ancora ascoltare gli audio e i video.
          </p>
        </>
      ) : reading === "never" ? (
        <p className="text-sm text-zinc-700 dark:text-zinc-300">
          Non l&apos;ho ancora letto: è arrivato in archivio prima che sapessi leggerne il
          contenuto. Finché non lo leggo, lo trovi solo per nome e note.
        </p>
      ) : reading === "nothing" ? (
        <p className="text-sm text-zinc-700 dark:text-zinc-300">
          L&apos;ho guardato il {doc.extractedAt ? formatDate(doc.extractedAt) : "—"}, ma non ci ho
          trovato testo. Capita con le foto che non ne contengono, o quando la scrittura è troppo
          sfocata per esserne sicuro.
        </p>
      ) : (
        <>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Letto il {doc.extractedAt ? formatDate(doc.extractedAt) : "—"} ·{" "}
            {doc.extractedText.length.toLocaleString("it-IT")} caratteri
          </p>
          <p
            data-testid="extracted-text"
            className="max-h-96 overflow-y-auto rounded-md bg-zinc-50 p-3 text-sm whitespace-pre-wrap text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
          >
            {shown}
            {tooLong && !fullText ? "…" : ""}
          </p>
          {tooLong ? (
            <button
              type="button"
              onClick={onToggleFullText}
              className="self-start text-sm font-medium text-accent underline-offset-2 hover:underline"
            >
              {fullText ? "Mostra meno" : "Mostra tutto"}
            </button>
          ) : null}
        </>
      )}

      {busy ? (
        <div role="status" aria-live="polite" className="flex flex-col gap-1.5">
          <p className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400">
            <Spinner />
            Lettura del documento sul dispositivo… {Math.round((rereading ?? 0) * 100)}%
          </p>
          <div
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round((rereading ?? 0) * 100)}
            aria-label="Avanzamento della lettura sul dispositivo"
            className="h-1.5 w-full max-w-sm overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800"
          >
            <div
              className="h-full rounded-full bg-brand transition-all duration-300"
              style={{ width: `${Math.round((rereading ?? 0) * 100)}%` }}
            />
          </div>
        </div>
      ) : null}

      {reading === "cannot" ? null : (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-200 pt-3 dark:border-zinc-800">
          <p className="min-w-0 text-xs text-zinc-500 dark:text-zinc-400">
            Letto qui, sul tuo dispositivo: questo testo non è mai uscito. Serve a ritrovare il
            contenuto quando lo cerchi.
          </p>
          <button
            type="button"
            disabled={busy}
            onClick={onReread}
            className="shrink-0 rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
          >
            {rereadLabel}
          </button>
        </div>
      )}
    </section>
  );
}
