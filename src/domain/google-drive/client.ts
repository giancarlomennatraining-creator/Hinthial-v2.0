import type { GoogleDriveFileToImport, GoogleDrivePickedItem } from "@/domain/google-drive/types";

/**
 * FASE 25 --- import da Google Drive, tutto lato client (v.
 * BulkImportForm.tsx). Nessun dato del Drive dell'utente passa dal
 * nostro server: il token OAuth (Google Identity Services) e il
 * download dei file (Drive API) restano nel browser, che poi cifra
 * ogni file con la Master Key esattamente come un file scelto dal
 * disco --- stesso percorso, stessa disciplina zero-knowledge.
 *
 * Scope: "drive.file" --- Hinthial ottiene accesso solo ai file/cartelle
 * scelti nel Picker qui sotto, mai una vista libera sul resto del
 * Drive. Chi apre una cartella qui vede solo i file al suo interno,
 * non le sue sottocartelle (v. listFolderFiles): scelta deliberata per
 * restare semplice --- v. discussione con l'utente su "niente costrutto
 * cartella permanente", che vale anche per la profondità dell'import.
 */

const FOLDER_MIME_TYPE = "application/vnd.google-apps.folder";
const PICKER_SCOPE = "https://www.googleapis.com/auth/drive.file";

/** Documenti nativi di Google (Docs/Sheets/Slides) non hanno byte scaricabili --- vanno esportati in un formato reale. */
const GOOGLE_NATIVE_EXPORT_MIME: Record<string, string> = {
  "application/vnd.google-apps.document": "application/pdf",
  "application/vnd.google-apps.spreadsheet": "application/pdf",
  "application/vnd.google-apps.presentation": "application/pdf",
};

/** Più di questi file in una sola cartella --- meglio scegliere una cartella più piccola che bloccare il browser su un elenco enorme. */
const MAX_FILES_PER_FOLDER = 300;

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient(config: {
            client_id: string;
            scope: string;
            callback: (response: { access_token?: string; error?: string }) => void;
          }): { requestAccessToken: () => void };
        };
      };
      picker: {
        DocsView: new (viewId?: unknown) => GoogleDocsView;
        PickerBuilder: new () => GooglePickerBuilder;
        ViewId: { DOCS: unknown };
        Feature: { MULTISELECT_ENABLED: unknown };
        Action: { PICKED: string; CANCEL: string };
      };
    };
    gapi?: { load(name: string, callback: () => void): void };
  }
}

interface GooglePickerResponse {
  action: string;
  docs?: Array<{ id: string; name: string; mimeType: string }>;
}

interface GoogleDocsView {
  setIncludeFolders(v: boolean): GoogleDocsView;
  setSelectFolderEnabled(v: boolean): GoogleDocsView;
}

interface GooglePickerBuilder {
  addView(view: unknown): GooglePickerBuilder;
  setOAuthToken(token: string): GooglePickerBuilder;
  setDeveloperKey(key: string): GooglePickerBuilder;
  enableFeature(feature: unknown): GooglePickerBuilder;
  setCallback(cb: (data: GooglePickerResponse) => void): GooglePickerBuilder;
  build(): { setVisible(v: boolean): void };
}

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Impossibile contattare Google."));
    document.head.appendChild(script);
  });
}

let apisReady: Promise<void> | null = null;

/** Carica Google Identity Services + il Picker una sola volta, riusando la stessa promessa a chiamate successive. */
function loadGoogleApis(): Promise<void> {
  if (!apisReady) {
    apisReady = Promise.all([
      loadScript("https://accounts.google.com/gsi/client"),
      loadScript("https://apis.google.com/js/api.js"),
    ]).then(
      () =>
        new Promise<void>((resolve) => {
          window.gapi!.load("picker", () => resolve());
        }),
    );
  }
  return apisReady;
}

function requestAccessToken(clientId: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const tokenClient = window.google!.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: PICKER_SCOPE,
      callback: (response) => {
        if (response.error || !response.access_token) {
          reject(new Error("Accesso a Google Drive non autorizzato."));
        } else {
          resolve(response.access_token);
        }
      },
    });
    tokenClient.requestAccessToken();
  });
}

function openPicker(accessToken: string, apiKey: string): Promise<GoogleDrivePickedItem[]> {
  return new Promise((resolve, reject) => {
    const picker = window.google!.picker;
    const view = new picker.DocsView(picker.ViewId.DOCS).setIncludeFolders(true).setSelectFolderEnabled(true);

    const builder = new picker.PickerBuilder()
      .addView(view)
      .setOAuthToken(accessToken)
      .setDeveloperKey(apiKey)
      .enableFeature(picker.Feature.MULTISELECT_ENABLED)
      .setCallback((data: GooglePickerResponse) => {
        if (data.action === picker.Action.PICKED) {
          resolve(
            (data.docs ?? []).map((doc) => ({
              id: doc.id,
              name: doc.name,
              mimeType: doc.mimeType,
              isFolder: doc.mimeType === FOLDER_MIME_TYPE,
            })),
          );
        } else if (data.action === picker.Action.CANCEL) {
          resolve([]);
        }
      });

    try {
      builder.build().setVisible(true);
    } catch {
      reject(new Error("Impossibile aprire il selettore di Google Drive."));
    }
  });
}

/** Solo i file dentro la cartella scelta --- non le sue sottocartelle (v. commento in testa al file). */
async function listFolderFiles(accessToken: string, folderId: string): Promise<GoogleDrivePickedItem[]> {
  const files: GoogleDrivePickedItem[] = [];
  let pageToken: string | undefined;

  do {
    const url = new URL("https://www.googleapis.com/drive/v3/files");
    url.searchParams.set("q", `'${folderId}' in parents and trashed = false and mimeType != '${FOLDER_MIME_TYPE}'`);
    url.searchParams.set("fields", "nextPageToken, files(id, name, mimeType)");
    url.searchParams.set("pageSize", "100");
    if (pageToken) url.searchParams.set("pageToken", pageToken);

    const response = await fetch(url.toString(), { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!response.ok) throw new Error("Impossibile leggere il contenuto della cartella su Google Drive.");
    const data: { files?: Array<{ id: string; name: string; mimeType: string }>; nextPageToken?: string } =
      await response.json();

    for (const file of data.files ?? []) {
      files.push({ id: file.id, name: file.name, mimeType: file.mimeType, isFolder: false });
    }
    if (files.length > MAX_FILES_PER_FOLDER) {
      throw new Error(
        `Questa cartella contiene più di ${MAX_FILES_PER_FOLDER} file --- scegli una cartella più piccola, o singoli file.`,
      );
    }
    pageToken = data.nextPageToken;
  } while (pageToken);

  return files;
}

async function downloadBytes(
  accessToken: string,
  item: GoogleDrivePickedItem,
): Promise<{ bytes: Uint8Array; mimeType: string; name: string }> {
  const exportMimeType = GOOGLE_NATIVE_EXPORT_MIME[item.mimeType];
  const url = exportMimeType
    ? `https://www.googleapis.com/drive/v3/files/${item.id}/export?mimeType=${encodeURIComponent(exportMimeType)}`
    : `https://www.googleapis.com/drive/v3/files/${item.id}?alt=media`;

  const response = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!response.ok) throw new Error(`Impossibile scaricare "${item.name}" da Google Drive.`);

  const bytes = new Uint8Array(await response.arrayBuffer());
  const mimeType = exportMimeType ?? item.mimeType;
  // Un Google Doc/Sheet/Slide esportato non ha già l'estensione nel nome.
  const name = exportMimeType && !item.name.toLowerCase().endsWith(".pdf") ? `${item.name}.pdf` : item.name;
  return { bytes, mimeType, name };
}

/**
 * Apre il selettore di Google Drive e restituisce i file pronti da
 * scaricare --- espandendo le cartelle scelte per intero al loro
 * contenuto (un solo livello, v. sopra), portando con sé il nome della
 * cartella come suggerimento di categoria. `files` è vuoto se l'utente
 * annulla, senza che sia un errore. Il token torna insieme ai file
 * perché serve di nuovo subito dopo, per scaricarne davvero i byte
 * (v. downloadGoogleDriveFile) --- resta valido solo per questa sessione
 * di importazione, non viene salvato da nessuna parte.
 */
export async function pickGoogleDriveFiles(
  clientId: string,
  apiKey: string,
): Promise<{ files: GoogleDriveFileToImport[]; accessToken: string }> {
  await loadGoogleApis();
  const accessToken = await requestAccessToken(clientId);
  const picked = await openPicker(accessToken, apiKey);

  const files: GoogleDriveFileToImport[] = [];
  for (const item of picked) {
    if (item.isFolder) {
      const contents = await listFolderFiles(accessToken, item.id);
      for (const file of contents) {
        files.push({ id: file.id, name: file.name, mimeType: file.mimeType, folderHint: item.name });
      }
    } else {
      files.push({ id: item.id, name: item.name, mimeType: item.mimeType, folderHint: null });
    }
  }

  return { files, accessToken };
}

/** Scarica il file scelto e lo trasforma in un File --- indistinguibile, da qui in avanti, da uno scelto dal disco. */
export async function downloadGoogleDriveFile(
  accessToken: string,
  item: GoogleDriveFileToImport,
): Promise<File> {
  const { bytes, mimeType, name } = await downloadBytes(accessToken, {
    id: item.id,
    name: item.name,
    mimeType: item.mimeType,
    isFolder: false,
  });
  // `bytes` è un Uint8Array<ArrayBufferLike> per come lo tipizza il DOM
  // più recente --- BlobPart vuole specificamente ArrayBuffer, mai
  // SharedArrayBuffer: qui è sempre il primo (arriva da arrayBuffer()),
  // il cast serve solo a dirlo a TypeScript.
  return new File([bytes as BlobPart], name, { type: mimeType });
}
