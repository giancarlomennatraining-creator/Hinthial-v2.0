import type { DocumentSummary } from "@/domain/documents/types";
import type { DossierListItem } from "@/domain/dossiers/types";

/**
 * FASE 21: riconoscimento di insiemi durante un caricamento massivo --- "serie ricorrenti" e "proposta di fascicoli"
 * sono un solo meccanismo: file che hanno lo stesso nome a meno di numeri e date ("bolletta-luce-2026-01.pdf",
 * "bolletta-luce-2026-02.pdf"). Niente somiglianza vaga né lettura del contenuto: nel dubbio, non si propone nulla.
 */

export interface NamedFile {
  file: File;
}

export interface ImportGroup<F extends NamedFile = NamedFile> {
  /** Il nome comune ai file del gruppo; null per i file che non condividono il nome con nessun altro di questo lotto. */
  label: string | null;
  files: F[];
  /** Fascicolo esistente con documenti dallo stesso nome --- il gruppo si propone di aggiungersi, non crearne un altro. */
  existingDossier: DossierListItem | null;
  /** Solo se non c'è un fascicolo da riusare e il gruppo ha almeno due file --- un documento solo non è "un raggruppamento". */
  proposedDossierTitle: string | null;
}

/**
 * Il nome senza estensione, numeri, date e separatori: "Bolletta_luce-2026-01.pdf" -> "bolletta luce". Serve almeno
 * un nome di due parole: "scan_0012.pdf" o "IMG_3041.jpg" sono nomi generici di uno scanner o di una fotocamera, non
 * dicono che due file siano la stessa vicenda.
 */
export function filenameStem(filename: string): string | null {
  const stem = filename
    .replace(/\.[^.]+$/, "")
    .toLowerCase()
    .replace(/[_\-.]+/g, " ")
    .replace(/\d+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return stem.split(" ").filter((word) => word.length >= 2).length >= 2 ? stem : null;
}

function labelOf(stem: string): string {
  return stem.charAt(0).toUpperCase() + stem.slice(1);
}

/** Raggruppa i file per nome; `existingDocuments`/`existingDossiers` servono a riconoscere una storia già iniziata. */
export function groupByFilename<F extends NamedFile>(
  files: F[],
  existingDocuments: Pick<DocumentSummary, "filename" | "dossierIds">[],
  existingDossiers: DossierListItem[],
): ImportGroup<F>[] {
  // Nome -> fascicolo, dai documenti GIA' in un fascicolo: stesso nome del gruppo nuovo = stessa vicenda.
  const dossierByStem = new Map<string, DossierListItem>();
  for (const document of existingDocuments) {
    if (document.dossierIds.length === 0) continue;
    const stem = filenameStem(document.filename);
    if (!stem || dossierByStem.has(stem)) continue;
    const dossier = existingDossiers.find((d) => document.dossierIds.includes(d.id));
    if (dossier) dossierByStem.set(stem, dossier);
  }

  const byStem = new Map<string, F[]>();
  const ungrouped: F[] = [];
  for (const item of files) {
    const stem = filenameStem(item.file.name);
    if (!stem) {
      ungrouped.push(item);
      continue;
    }
    const group = byStem.get(stem) ?? [];
    group.push(item);
    byStem.set(stem, group);
  }

  const groups: ImportGroup<F>[] = [];
  for (const [stem, grouped] of byStem) {
    const existingDossier = dossierByStem.get(stem) ?? null;
    groups.push({
      label: labelOf(stem),
      files: grouped,
      existingDossier,
      proposedDossierTitle: !existingDossier && grouped.length >= 2 ? labelOf(stem) : null,
    });
  }
  for (const item of ungrouped) {
    groups.push({ label: null, files: [item], existingDossier: null, proposedDossierTitle: null });
  }

  return groups;
}
