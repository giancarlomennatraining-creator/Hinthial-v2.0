import { heuristicCategorizer } from "@/domain/categorizer/heuristic-provider";
import { extractStructuredFields } from "@/domain/extraction/structured-fields";
import type { Category } from "@/domain/categories/types";
import type { DocumentListItem } from "@/domain/documents/types";
import type { Proposal, ProposalRejection } from "@/domain/proposals/types";

/**
 * FASE 19 --- che cosa Hinthial ha da proporre su questo documento.
 *
 * Funzione pura: stesso documento, stessi rifiuti, stesse proposte. È
 * deliberato --- è la funzione che decide quando l'app chiede qualcosa
 * all'utente, e una cosa del genere deve essere verificabile riga per
 * riga invece che osservata a occhio.
 *
 * Tre filtri, in quest'ordine, e ognuno esiste per un motivo preciso:
 *
 * 1. **Niente proposte su campi già compilati.** Se la scadenza c'è già,
 *    proporne una significa mettere in discussione una scelta
 *    dell'utente, non aiutarlo. Vale anche al contrario: se svuota quel
 *    campo, la proposta torna --- il documento è tornato incompleto.
 * 2. **Niente proposte già rifiutate.** Il confronto è sul *valore*, non
 *    sul tipo: se una rilettura ricava una scadenza diversa, quella è
 *    una proposta nuova e va fatta. Rifiutare "3 giugno 2027" non
 *    significa rifiutare per sempre l'idea che il documento scada.
 * 3. **Niente proposte senza una fonte da mostrare.** Se non si può
 *    dire da dove viene, non si propone.
 *
 * Scadenza ed emittente possono avere più di un candidato (v.
 * structured-fields.ts, richiesta utente): ognuno diventa una proposta
 * a sé, con la propria fonte. Appena una viene accettata il campo si
 * riempie, e il filtro 1 fa sparire da sola ogni altra proposta dello
 * stesso tipo --- nessuna pulizia manuale da fare qui.
 */
export function buildProposals(
  doc: DocumentListItem,
  categories: Category[],
  rejections: ProposalRejection[],
): Proposal[] {
  const proposals: Proposal[] = [];

  // --- Scadenza: ogni candidato trovato, solo se il documento non ne ha già una.
  if (!doc.expiresAt) {
    const expiries = extractStructuredFields(doc.extractedText).filter((f) => f.kind === "expiry");
    for (const expiry of expiries) {
      proposals.push({
        kind: "expiry",
        value: expiry.value,
        source: expiry.context,
        derived: expiry.derived,
      });
    }
  }

  // --- Categoria: solo se il documento non ne ha già una.
  if (!doc.categoryId) {
    const suggestion = heuristicCategorizer.suggestCategoryFromContent(
      doc.filename,
      doc.extractedText,
      categories,
    );
    const category = categories.find((c) => c.id === suggestion);
    if (category) {
      proposals.push({
        kind: "category",
        value: category.id,
        source: sourceForCategory(doc, category),
      });
    }
  }

  // --- Emittente: ogni candidato trovato, solo se il documento non ne ha già uno.
  if (!doc.issuer) {
    const issuers = extractStructuredFields(doc.extractedText).filter((f) => f.kind === "issuer");
    for (const issuer of issuers) {
      proposals.push({ kind: "issuer", value: issuer.value, source: issuer.context });
    }
  }

  // Difesa in profondità: due candidati distinti non producono mai lo
  // stesso valore in pratica, ma se succedesse non deve comparire due
  // volte la stessa proposta.
  const deduped = proposals.filter(
    (proposal, index) =>
      !proposals.slice(0, index).some((p) => p.kind === proposal.kind && p.value === proposal.value),
  );

  return deduped.filter(
    (proposal) =>
      !rejections.some((r) => r.kind === proposal.kind && r.value === proposal.value),
  );
}

/**
 * Perché questa categoria. Non si prova a indovinare quale parola chiave
 * abbia fatto scattare la corrispondenza --- si dice dove si è guardato,
 * che è l'informazione che serve a capire se fidarsi: un suggerimento
 * ricavato dal nome del file è verificabile a colpo d'occhio, uno
 * ricavato dal testo richiede di leggere il testo.
 */
function sourceForCategory(doc: DocumentListItem, category: Category): string {
  const fromFilename = heuristicCategorizer.suggestCategory(doc.filename, [category]);
  return fromFilename
    ? `Dal nome del file: "${doc.filename}"`
    : "Da quello che c'è scritto nel documento";
}
