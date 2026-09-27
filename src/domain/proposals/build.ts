import { heuristicCategorizer } from "@/domain/categorizer/heuristic-provider";
import { extractStructuredFields } from "@/domain/extraction/structured-fields";
import type { Category } from "@/domain/categories/types";
import type { DocumentListItem } from "@/domain/documents/types";
import type { Proposal, ProposalRejection } from "@/domain/proposals/types";

/**
 * FASE 19: che cosa proporre su questo documento --- pura (stesso input, stesso output), verificabile riga per riga.
 * Tre filtri: niente proposte su campi già compilati (torna se il campo si svuota), niente già rifiutate (confronto
 * sul valore, non sul tipo), niente senza una fonte. Scadenza/emittente possono avere più candidati, uno a proposta.
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

  // Difesa in profondità: due candidati distinti non dovrebbero mai coincidere, ma se succede non va duplicata.
  const deduped = proposals.filter(
    (proposal, index) =>
      !proposals.slice(0, index).some((p) => p.kind === proposal.kind && p.value === proposal.value),
  );

  return deduped.filter(
    (proposal) =>
      !rejections.some((r) => r.kind === proposal.kind && r.value === proposal.value),
  );
}

/** Dice dove si è guardato, non quale parola chiave --- un suggerimento dal nome file è verificabile a colpo d'occhio. */
function sourceForCategory(doc: DocumentListItem, category: Category): string {
  const fromFilename = heuristicCategorizer.suggestCategory(doc.filename, [category]);
  return fromFilename
    ? `Dal nome del file: "${doc.filename}"`
    : "Da quello che c'è scritto nel documento";
}
