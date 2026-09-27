import type { DocumentListItem } from "@/domain/documents/types";

/** FASE 25: rilevamento duplicati in import massivo --- stessa disciplina di groupByIssuer, corrispondenza esatta (nome+dimensione), mai vaga. */

export interface DuplicateMatch {
  /** Il nome del documento già presente (o dell'altro file di questo stesso lotto) con cui coincide. */
  filename: string;
  /** Data di caricamento del documento già in Archivio --- "" se la corrispondenza è con un altro file di questo stesso lotto, non ancora caricato. */
  createdAt: string;
}

/** Un elemento per posizione in `files`, o `null`. Confronta con l'archivio esistente e con i file precedenti nello stesso lotto. */
export function detectDuplicates<F extends { file: File }>(
  files: F[],
  existingDocuments: DocumentListItem[],
): (DuplicateMatch | null)[] {
  const results: (DuplicateMatch | null)[] = [];

  for (let i = 0; i < files.length; i++) {
    const { file } = files[i];
    const existingMatch = existingDocuments.find(
      (doc) => doc.filename.toLowerCase() === file.name.toLowerCase() && doc.size === file.size,
    );
    if (existingMatch) {
      results.push({ filename: existingMatch.filename, createdAt: existingMatch.createdAt });
      continue;
    }

    const batchMatch = files
      .slice(0, i)
      .find((other) => other.file.name.toLowerCase() === file.name.toLowerCase() && other.file.size === file.size);
    results.push(batchMatch ? { filename: batchMatch.file.name, createdAt: "" } : null);
  }

  return results;
}
