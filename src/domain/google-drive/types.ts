/**
 * FASE 25 --- import da Google Drive con un file browser proprio
 * (v. client.ts, GoogleDriveBrowser.tsx). Non più il Picker di Google:
 * per disegnare noi la navigazione a cartelle serve poter interrogare
 * l'intero Drive via API (scope drive.readonly), non solo ricevere ciò
 * che un widget di Google ci consegna già scelto --- scelta discussa
 * con l'utente, che accetta lo scope più ampio in cambio della grafica
 * coerente con Hinthial.
 */
export interface GoogleDriveItem {
  id: string;
  name: string;
  mimeType: string;
  isFolder: boolean;
}

export interface GoogleDriveFileToImport {
  id: string;
  name: string;
  mimeType: string;
  /** Nome della cartella da cui arriva questo file --- solo un suggerimento di categoria, mai un dato salvato (v. discussione con l'utente: niente costrutto "cartella" permanente). */
  folderHint: string | null;
}
