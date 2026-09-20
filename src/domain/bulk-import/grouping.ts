import { extractStructuredFields } from "@/domain/extraction/structured-fields";
import type { DocumentListItem } from "@/domain/documents/types";
import type { DossierListItem } from "@/domain/dossiers/types";

/**
 * FASE 21 --- riconoscimento di insiemi, durante un caricamento massivo.
 *
 * Copre insieme due voci del piano che sono, in pratica, la stessa cosa
 * vista da due momenti diversi: **"rilevamento di serie ricorrenti"**
 * (lo stesso emittente che torna --- bollette dello stesso fornitore, più
 * referti dello stesso laboratorio) e **"proposta di fascicoli dai
 * raggruppamenti evidenti"** (quello stesso gruppo, se non ha ancora una
 * casa, diventa la proposta di un fascicolo nuovo).
 *
 * Un solo meccanismo, deterministico e già testato altrove: **lo stesso
 * emittente** (v. FASE 18, `findIssuer` --- richiede una forma societaria
 * o un'intestazione in maiuscolo, non una somiglianza vaga). Niente
 * confronto di significato, niente soglie di similarità: o due documenti
 * hanno letteralmente lo stesso emittente riconosciuto, o non sono un
 * insieme. È la stessa disciplina già applicata al resto della FASE 18 e
 * 19 --- nel dubbio, non si propone nulla.
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
  /**
   * Un fascicolo già esistente che ha già documenti con questo stesso
   * emittente --- il gruppo si propone di aggiungersi a quello, non di
   * crearne un altro.
   */
  existingDossier: DossierListItem | null;
  /**
   * Proposto solo se non c'è un fascicolo esistente da riusare **e** il
   * gruppo ha almeno due file --- un documento solo non è "un
   * raggruppamento evidente", è solo un documento.
   */
  proposedDossierTitle: string | null;
}

function issuerOf(text: string | null): string | null {
  if (!text) return null;
  return extractStructuredFields(text).find((field) => field.kind === "issuer")?.value ?? null;
}

/**
 * Raggruppa i file di un caricamento massivo per emittente, e per ogni
 * gruppo dice se corrisponde a un fascicolo già esistente o merita una
 * proposta di fascicolo nuovo.
 *
 * `existingDocuments`/`existingDossiers` sono quelli già in Archivio:
 * servono a riconoscere quando il gruppo appena arrivato appartiene a
 * una storia già iniziata, invece di proporne sempre una nuova.
 */
export function groupByIssuer<F extends ReadFile>(
  readFiles: F[],
  existingDocuments: DocumentListItem[],
  existingDossiers: DossierListItem[],
): ImportGroup<F>[] {
  // Emittente -> fascicolo, costruita guardando i documenti che sono
  // GIA' in un fascicolo: se uno di loro condivide l'emittente col
  // gruppo nuovo, è la stessa vicenda.
  const dossierByIssuer = new Map<string, DossierListItem>();
  for (const document of existingDocuments) {
    if (!document.dossierId) continue;
    const issuer = issuerOf(document.extractedText);
    if (!issuer || dossierByIssuer.has(issuer)) continue;
    const dossier = existingDossiers.find((d) => d.id === document.dossierId);
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
