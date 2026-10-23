/**
 * Il repository dei documenti, in moduli per compito (v. i file qui accanto):
 * - row-mapping: dalle righe del database ai documenti decifrati, e viceversa;
 * - read: elenchi e letture;
 * - write: caricamento, creazione di note, modifica dei dati e dei risultati di lettura;
 * - files: scaricamento, miniature e lettura del testo;
 * - removal: cestino ed eliminazione.
 * Questo file resta l'unico punto da cui importare: stessi nomi di prima.
 */
export * from "@/domain/documents/read";
export * from "@/domain/documents/write";
export * from "@/domain/documents/files";
export * from "@/domain/documents/removal";
export { encryptStructuredFields, decryptStructuredFields } from "@/domain/documents/row-mapping";
