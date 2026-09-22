import type { DocumentListItem } from "@/domain/documents/types";

/**
 * FASE 25 --- rilevamento duplicati durante un import massivo (in
 * particolare da Google Drive, dove lo stesso file può arrivare da più
 * strade). Stessa disciplina di findIssuer/groupByIssuer: una
 * corrispondenza esatta (nome file e dimensione in byte identici),
 * mai una somiglianza vaga --- nel dubbio, nessun avviso.
 */

export interface DuplicateMatch {
  /** Il nome del documento già presente (o dell'altro file di questo stesso lotto) con cui coincide. */
  filename: string;
  /** Data di caricamento del documento già in Archivio --- "" se la corrispondenza è con un altro file di questo stesso lotto, non ancora caricato. */
  createdAt: string;
}

/**
 * Un elemento per posizione in `files`: la corrispondenza trovata (con
 * l'Archivio già esistente, o con un file precedente nello stesso
 * lotto), o `null` se nessuna. Confronta ogni file sia con l'archivio
 * sia con quelli che lo precedono nello stesso lotto --- due file
 * arrivati insieme con lo stesso nome e la stessa dimensione sono lo
 * stesso file arrivato da due strade, non una coincidenza.
 */
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
