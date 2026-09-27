import { extractStructuredFields } from "@/domain/extraction/structured-fields";
import type { DocumentListItem } from "@/domain/documents/types";
import type { DossierListItem } from "@/domain/dossiers/types";

/**
 * FASE 21: riconoscimento di insiemi durante un caricamento massivo --- "serie ricorrenti" e "proposta di fascicoli"
 * sono un solo meccanismo, lo stesso emittente riconosciuto (v. findIssuers). Niente somiglianza vaga: nel dubbio,
 * non si propone nulla.
 */

export interface ReadFile {
  file: File;
  /** null se il tipo non si legge, o se non ci ha trovato nulla. */
  text: string | null;
}

export interface ImportGroup<F extends ReadFile = ReadFile> {
  /** null per i file che non condividono l'emittente con nessun altro di questo lotto. */
  issuer: string | null;
  files: F[];
  /** Fascicolo esistente con documenti dello stesso emittente --- il gruppo si propone di aggiungersi, non crearne un altro. */
  existingDossier: DossierListItem | null;
  /** Solo se non c'è un fascicolo da riusare e il gruppo ha almeno due file --- un documento solo non è "un raggruppamento". */
  proposedDossierTitle: string | null;
}

function issuerOf(text: string | null): string | null {
  if (!text) return null;
  return extractStructuredFields(text).find((field) => field.kind === "issuer")?.value ?? null;
}

/** Raggruppa i file per emittente; `existingDocuments`/`existingDossiers` servono a riconoscere una storia già iniziata. */
export function groupByIssuer<F extends ReadFile>(
  readFiles: F[],
  existingDocuments: DocumentListItem[],
  existingDossiers: DossierListItem[],
): ImportGroup<F>[] {
  // Emittente -> fascicolo, dai documenti GIA' in un fascicolo: stesso emittente del gruppo nuovo = stessa vicenda.
  const dossierByIssuer = new Map<string, DossierListItem>();
  for (const document of existingDocuments) {
    if (document.dossierIds.length === 0) continue;
    const issuer = issuerOf(document.extractedText);
    if (!issuer || dossierByIssuer.has(issuer)) continue;
    const dossier = existingDossiers.find((d) => document.dossierIds.includes(d.id));
    if (dossier) dossierByIssuer.set(issuer, dossier);
  }

  const byIssuer = new Map<string, F[]>();
  const ungrouped: F[] = [];
  for (const readFile of readFiles) {
    const issuer = issuerOf(readFile.text);
    if (!issuer) {
      ungrouped.push(readFile);
      continue;
    }
    const files = byIssuer.get(issuer) ?? [];
    files.push(readFile);
    byIssuer.set(issuer, files);
  }

  const groups: ImportGroup<F>[] = [];
  for (const [issuer, files] of byIssuer) {
    const existingDossier = dossierByIssuer.get(issuer) ?? null;
    groups.push({
      issuer,
      files,
      existingDossier,
      proposedDossierTitle: !existingDossier && files.length >= 2 ? issuer : null,
    });
  }
  for (const readFile of ungrouped) {
    groups.push({ issuer: null, files: [readFile], existingDossier: null, proposedDossierTitle: null });
  }

  return groups;
}
