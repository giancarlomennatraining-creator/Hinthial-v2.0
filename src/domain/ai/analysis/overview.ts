import { mergeBlocks } from "@/domain/ai/analysis/merge";
import type { PersistedContentAnalysis } from "@/domain/ai/analysis/persisted";
import { ANALYSIS_SCHEMAS } from "@/domain/ai/analysis/schemas";
import type { Provenance, ValidatedEvidence } from "@/domain/ai/analysis/validate";
import type { DocumentListItem } from "@/domain/documents/types";

/**
 * Content Intelligence, PR4: la lettura di Hinthia com'è mostrata nella scheda (§13). Ogni dato qui è già passato dal
 * controllo sulla citazione (v. validate.ts), quindi la "confidenza" è quella: verificato nel testo o scartato. Il modello
 * non dà un numero e non se ne inventa uno.
 */

export type OverviewFactKind = "expiry" | "issuer" | "category" | "field" | "event";

export interface OverviewFact {
  /** Chiave stabile dentro l'elenco (per React). */
  id: string;
  kind: OverviewFactKind;
  label: string;
  value: string;
  /** "date" = il value è YYYY-MM-DD e si mostra come data. */
  valueType: "date" | "text";
  /** La citazione del documento che lo prova. */
  quote: string;
  provenance: Provenance;
  /** Già nella Scheda (o, per un evento, già in Scadenze): il dato è tuo, non solo una lettura di Hinthia. */
  adopted: boolean;
}

export interface AnalysisOverview {
  typeLabel: string;
  /** False quando il documento non rientra in nessun tipo noto: si dice "generico", non si finge di averlo riconosciuto. */
  typeRecognized: boolean;
  facts: OverviewFact[];
  coverage: { read: number; total: number; truncated: boolean };
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const sameText = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

function fact(
  id: string,
  kind: OverviewFactKind,
  label: string,
  evidence: ValidatedEvidence,
  adopted: boolean,
  valueType?: "date" | "text",
): OverviewFact {
  return {
    id,
    kind,
    label,
    value: evidence.value,
    valueType: valueType ?? (ISO_DATE.test(evidence.value) ? "date" : "text"),
    quote: evidence.source,
    provenance: evidence.provenance,
    adopted,
  };
}

export function buildAnalysisOverview(
  analysis: PersistedContentAnalysis,
  doc: Pick<DocumentListItem, "categoryId" | "expiresAt" | "issuer" | "structuredFields">,
  categories: { id: string; name: string }[],
  /** I giorni dei promemoria già collegati al documento (YYYY-MM-DD, ora locale). */
  reminderDates: string[],
): AnalysisOverview {
  const merged = mergeBlocks(analysis.blocks);
  const facts: OverviewFact[] = [];

  if (merged.category) {
    const category = categories.find((c) => c.id === merged.category?.value);
    // Una categoria eliminata dopo la lettura non è più un'informazione utile.
    if (category) {
      facts.push({
        ...fact("category", "category", "Categoria", merged.category, doc.categoryId === category.id, "text"),
        value: category.name,
      });
    }
  }
  merged.expiry.forEach((e, i) =>
    facts.push(
      fact(`expiry-${i}`, "expiry", "Scadenza", e, doc.expiresAt !== null && doc.expiresAt.slice(0, 10) === e.value, "date"),
    ),
  );
  merged.issuer.forEach((e, i) =>
    facts.push(fact(`issuer-${i}`, "issuer", "Emittente", e, sameText(doc.issuer, e.value), "text")),
  );
  for (const f of merged.fields) {
    const current = doc.structuredFields[f.key];
    facts.push(fact(`field-${f.key}`, "field", f.label, f, current !== undefined && sameText(current, f.value)));
  }
  for (const event of merged.events) {
    facts.push({
      ...fact(`event-${event.value}`, "event", event.title, event, reminderDates.includes(event.value), "date"),
    });
  }

  const schema = ANALYSIS_SCHEMAS[analysis.documentType ?? "generico"];
  return {
    typeLabel: schema.label,
    typeRecognized: analysis.documentType !== null && analysis.documentType !== "generico",
    facts,
    coverage: {
      read: analysis.blocks.length,
      total: analysis.blocksTotalBeforeCap,
      truncated: analysis.truncated,
    },
  };
}
