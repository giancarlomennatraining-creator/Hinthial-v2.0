import type { GoogleDriveFileToImport, GoogleDriveItem } from "@/domain/google-drive/types";

/**
 * FASE 25: import da Google Drive tutto lato client --- token OAuth e chiamate Drive API restano nel browser, poi
 * cifrato con la Master Key come un file dal disco. Scope "drive.readonly" (non "drive.file", serve per la
 * navigazione a cartelle nostra) richiede la verifica standard di Google, non l'audit a pagamento di Gmail (FASE 26).
 */

const FOLDER_MIME_TYPE = "application/vnd.google-apps.folder";
const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.readonly";

/** Documenti nativi di Google (Docs/Sheets/Slides) non hanno byte scaricabili --- vanno esportati in un formato reale. */
const GOOGLE_NATIVE_EXPORT_MIME: Record<string, string> = {
  "application/vnd.google-apps.document": "application/pdf",
  "application/vnd.google-apps.spreadsheet": "application/pdf",
  "application/vnd.google-apps.presentation": "application/pdf",
};

/** Più di questi file in un solo import (una cartella scelta per intero conta tutti i suoi discendenti) --- meglio chiedere di scegliere un insieme più piccolo che bloccare il browser. */
const MAX_FILES_PER_IMPORT = 500;

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient(config: {
            client_id: string;
            scope: string;
            callback: (response: { access_token?: string; error?: string; expires_in?: number }) => void;
          }): { requestAccessToken: (overrides?: { prompt?: string }) => void };
        };
      };
    };
  }
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

/** Carica Google Identity Services una sola volta, riusando la stessa promessa a chiamate successive. */
function loadGoogleApis(): Promise<void> {
  if (!apisReady) apisReady = loadScript("https://accounts.google.com/gsi/client");
  return apisReady;
}

// In memoria, non in storage --- come la Master Key, non va persistito. Margine di sicurezza di 5 minuti prima di considerarlo scaduto.
let cachedToken: { accessToken: string; expiresAtMs: number } | null = null;
const TOKEN_EXPIRY_SAFETY_MARGIN_MS = 5 * 60 * 1000;

function requestAccessToken(clientId: string): Promise<string> {
  if (cachedToken && cachedToken.expiresAtMs > Date.now() + TOKEN_EXPIRY_SAFETY_MARGIN_MS) {
    return Promise.resolve(cachedToken.accessToken);
  }

  return new Promise((resolve, reject) => {
    const tokenClient = window.google!.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: DRIVE_SCOPE,
      callback: (response) => {
        if (response.error || !response.access_token) {
          reject(new Error("Accesso a Google Drive non autorizzato."));
          return;
        }
        cachedToken = {
          accessToken: response.access_token,
          expiresAtMs: Date.now() + (response.expires_in ?? 3600) * 1000,
        };
        resolve(response.access_token);
      },
    });
    // "prompt: ''" tenta un consenso silenzioso: un solo consenso per sessione, non uno a ogni apertura.
    tokenClient.requestAccessToken({ prompt: "" });
  });
}

/** Un solo punto d'ingresso per il file browser: carica Google Identity Services e ottiene un token valido, riusando la cache se possibile. */
export async function ensureDriveAccessToken(clientId: string): Promise<string> {
  await loadGoogleApis();
  return requestAccessToken(clientId);
}

/** Contenuto diretto di una cartella (non i discendenti), una pagina alla volta --- `folderId` accetta "root" per Il mio Drive. */
export async function listDriveFolder(
  accessToken: string,
  folderId: string,
  pageToken?: string,
): Promise<{ items: GoogleDriveItem[]; nextPageToken?: string }> {
  const url = new URL("https://www.googleapis.com/drive/v3/files");
  url.searchParams.set("q", `'${folderId}' in parents and trashed = false`);
  url.searchParams.set("fields", "nextPageToken, files(id, name, mimeType)");
  url.searchParams.set("orderBy", "folder,name");
  url.searchParams.set("pageSize", "100");
  if (pageToken) url.searchParams.set("pageToken", pageToken);

  const response = await fetch(url.toString(), { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!response.ok) throw new Error("Impossibile leggere questa cartella di Google Drive.");
  const data: { files?: Array<{ id: string; name: string; mimeType: string }>; nextPageToken?: string } =
    await response.json();

  const items: GoogleDriveItem[] = (data.files ?? []).map((file) => ({
    id: file.id,
    name: file.name,
    mimeType: file.mimeType,
    isFolder: file.mimeType === FOLDER_MIME_TYPE,
  }));
  return { items, nextPageToken: data.nextPageToken };
}

interface ImportBudget {
  remaining: number;
}

/** Ogni file dentro una cartella, a qualunque profondità --- con lo stesso nome di cartella (quella scelta per intera dall'utente, non le sue sottocartelle) come suggerimento di categoria per tutti. */
async function listFolderFilesRecursive(
  accessToken: string,
  folderId: string,
  folderHint: string,
  budget: ImportBudget,
): Promise<GoogleDriveFileToImport[]> {
  const files: GoogleDriveFileToImport[] = [];
  let pageToken: string | undefined;

  do {
    const { items, nextPageToken } = await listDriveFolder(accessToken, folderId, pageToken);
    for (const item of items) {
      if (item.isFolder) {
        files.push(...(await listFolderFilesRecursive(accessToken, item.id, folderHint, budget)));
      } else {
        budget.remaining--;
        if (budget.remaining < 0) {
          throw new Error(
            `Hai selezionato più di ${MAX_FILES_PER_IMPORT} file in totale --- scegli un insieme più piccolo.`,
          );
        }
        files.push({ id: item.id, name: item.name, mimeType: item.mimeType, folderHint });
      }
    }
    pageToken = nextPageToken;
  } while (pageToken);

  return files;
}

/** Espande la selezione (cartelle intere + file singoli) nell'elenco vero da scaricare, a qualunque profondità. */
export async function resolveDriveSelection(
  accessToken: string,
  selection: {
    folders: { id: string; name: string }[];
    files: { id: string; name: string; mimeType: string; folderHint: string | null }[];
  },
): Promise<GoogleDriveFileToImport[]> {
  const budget: ImportBudget = { remaining: MAX_FILES_PER_IMPORT - selection.files.length };
  if (budget.remaining < 0) {
    throw new Error(`Hai selezionato più di ${MAX_FILES_PER_IMPORT} file — scegli un insieme più piccolo.`);
  }

  const fromFolders: GoogleDriveFileToImport[] = [];
  for (const folder of selection.folders) {
    fromFolders.push(...(await listFolderFilesRecursive(accessToken, folder.id, folder.name, budget)));
  }

  return [...selection.files.map((f) => ({ ...f })), ...fromFolders];
}

async function downloadBytes(
  accessToken: string,
  item: { id: string; name: string; mimeType: string },
): Promise<{ bytes: Uint8Array; mimeType: string; name: string }> {
  const exportMimeType = GOOGLE_NATIVE_EXPORT_MIME[item.mimeType];
  const url = exportMimeType
    ? `https://www.googleapis.com/drive/v3/files/${item.id}/export?mimeType=${encodeURIComponent(exportMimeType)}`
    : `https://www.googleapis.com/drive/v3/files/${item.id}?alt=media`;

  const response = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(
      `Impossibile scaricare "${item.name}" da Google Drive (${response.status}).${detail ? ` ${detail}` : ""}`,
    );
  }

  const bytes = new Uint8Array(await response.arrayBuffer());
  const mimeType = exportMimeType ?? item.mimeType;
  // Un Google Doc/Sheet/Slide esportato non ha già l'estensione nel nome.
  const name = exportMimeType && !item.name.toLowerCase().endsWith(".pdf") ? `${item.name}.pdf` : item.name;
  return { bytes, mimeType, name };
}

/** Scarica il file scelto e lo trasforma in un File --- indistinguibile, da qui in avanti, da uno scelto dal disco. */
export async function downloadGoogleDriveFile(
  accessToken: string,
  item: GoogleDriveFileToImport,
): Promise<File> {
  const { bytes, mimeType, name } = await downloadBytes(accessToken, item);
  // BlobPart vuole ArrayBuffer, mai SharedArrayBuffer --- qui è sempre il primo (da arrayBuffer()), il cast lo dice a TypeScript.
  return new File([bytes as BlobPart], name, { type: mimeType });
}
