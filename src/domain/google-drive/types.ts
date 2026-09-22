/**
 * FASE 25 --- import da Google Drive. Un elemento scelto nel Picker di
 * Google (v. client.ts): un file da scaricare direttamente, o una
 * cartella di cui elencare il contenuto. `folderHint` --- il nome della
 * cartella di provenienza, se l'elemento arriva da una cartella scelta
 * per intero --- serve solo come suggerimento di categoria (v.
 * BulkImportForm.tsx), non diventa un dato salvato: niente costrutto
 * "cartella" permanente nell'archivio, per una scelta discussa con
 * l'utente (i Fascicoli già coprono, meglio, il bisogno di raggruppare
 * oltre la categoria).
 */
export interface GoogleDrivePickedItem {
  id: string;
  name: string;
  mimeType: string;
  isFolder: boolean;
}

export interface GoogleDriveFileToImport {
  id: string;
  name: string;
  mimeType: string;
  /** Nome della cartella scelta per intero da cui arriva questo file --- null se il file è stato scelto individualmente. */
  folderHint: string | null;
}
