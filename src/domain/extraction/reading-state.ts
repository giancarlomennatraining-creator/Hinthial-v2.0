import { canExtractText } from "@/domain/extraction/extract-text";
import { contentKindFor } from "@/lib/content-kind";
import type { DocumentListItem } from "@/domain/documents/types";

/**
 * FASE 17e --- in che rapporto sta Hinthial con il contenuto di un
 * elemento d'Archivio. Sono quattro stati che fino alla pagina di
 * dettaglio non avevano modo di essere raccontati: dal di fuori erano
 * tutti indistinguibili, perché in tre casi su quattro il testo
 * risultava semplicemente vuoto.
 *
 * - `own-text`  il contenuto **è** testo (una nota): non c'è niente da
 *               estrarre, si legge direttamente.
 * - `cannot`    Hinthial non sa ancora leggere questo tipo (audio,
 *               video): aspetta la trascrizione.
 * - `never`     saprebbe leggerlo, ma non ci ha mai provato --- caricato
 *               prima che l'estrazione esistesse (v. `extractedAt`).
 * - `nothing`   ci ha provato e non ha trovato niente. Con l'OCR è
 *               diventato raro: di solito è una foto senza testo.
 * - `text`      ci ha provato e ha trovato del testo.
 */
export type ReadingState = "own-text" | "cannot" | "never" | "nothing" | "text";

export function readingStateFor(
  doc: Pick<DocumentListItem, "mimeType" | "extractedText" | "extractedAt">,
): ReadingState {
  if (contentKindFor(doc.mimeType) === "note") return "own-text";
  if (!canExtractText(doc.mimeType)) return "cannot";
  if (doc.extractedAt === null) return "never";
  return doc.extractedText.trim() ? "text" : "nothing";
}
