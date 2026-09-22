"use client";

import { useCallback, useEffect, useState } from "react";
import {
  downloadGoogleDriveFile,
  ensureDriveAccessToken,
  listDriveFolder,
  resolveDriveSelection,
} from "@/domain/google-drive/client";
import type { GoogleDriveItem } from "@/domain/google-drive/types";

/**
 * FASE 25 --- file browser di Google Drive con la grafica di Hinthial
 * (v. richiesta utente, dopo aver visto il Picker di Google: "voglio la
 * navigazione a cartelle con la nostra grafica"). Un solo livello di
 * cartella caricato alla volta (mai tutto il Drive insieme), selezione
 * di file singoli o di cartelle intere --- una cartella selezionata
 * viene espansa a tutti i suoi file, a qualunque profondità, solo al
 * momento dell'importazione (resolveDriveSelection), non mentre si
 * naviga: nessuna richiesta in più per ogni riga mostrata.
 *
 * Semplificazione dichiarata: niente conteggio "N elementi" su una
 * cartella non ancora aperta (richiederebbe una richiesta per riga,
 * costosa su un Drive con molte cartelle) e niente indicatore "parziale"
 * sulle cartelle --- una cartella è scelta per intero o non lo è.
 */

interface BreadcrumbEntry {
  id: string;
  name: string;
}

export function GoogleDriveBrowser({
  clientId,
  onClose,
  onConfirm,
}: {
  clientId: string;
  onClose: () => void;
  /** Già scaricati --- indistinguibili, da qui, da un file scelto dal disco. */
  onConfirm: (files: { file: File; folderHint: string | null }[]) => void;
}) {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);

  const [path, setPath] = useState<BreadcrumbEntry[]>([{ id: "root", name: "Il mio Drive" }]);
  const [items, setItems] = useState<GoogleDriveItem[]>([]);
  const [nextPageToken, setNextPageToken] = useState<string | undefined>(undefined);
  const [loadingItems, setLoadingItems] = useState(false);
  const [listError, setListError] = useState<string | null>(null);

  const [selectedFolders, setSelectedFolders] = useState<Map<string, string>>(new Map());
  const [selectedFiles, setSelectedFiles] = useState<
    Map<string, { name: string; mimeType: string; folderHint: string | null }>
  >(new Map());

  const [resolving, setResolving] = useState(false);
  const [resolveError, setResolveError] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<{ done: number; total: number } | null>(null);

  const currentFolder = path[path.length - 1];
  const currentFolderIsFullySelected = selectedFolders.has(currentFolder.id);

  useEffect(() => {
    ensureDriveAccessToken(clientId)
      .then((token) => setAccessToken(token))
      .catch((err) => setAuthError(err instanceof Error ? err.message : "Accesso a Google Drive non riuscito."));
  }, [clientId]);

  const loadFolder = useCallback(
    async (folderId: string, pageToken?: string, append = false) => {
      if (!accessToken) return;
      setLoadingItems(true);
      setListError(null);
      try {
        const { items: loaded, nextPageToken: next } = await listDriveFolder(accessToken, folderId, pageToken);
        setItems((prev) => (append ? [...prev, ...loaded] : loaded));
        setNextPageToken(next);
      } catch (err) {
        setListError(err instanceof Error ? err.message : "Impossibile leggere questa cartella.");
      } finally {
        setLoadingItems(false);
      }
    },
    [accessToken],
  );

  useEffect(() => {
    // Stesso pattern di loadContext in GlobalSearch.tsx --- lo setState
    // vero avviene dentro loadFolder, chiamata da qui a ogni cambio di
    // cartella (non solo al montaggio).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadFolder(currentFolder.id);
  }, [currentFolder.id, loadFolder]);

  function loadMore() {
    if (nextPageToken) void loadFolder(currentFolder.id, nextPageToken, true);
  }

  function openFolder(item: GoogleDriveItem) {
    setPath((prev) => [...prev, { id: item.id, name: item.name }]);
  }

  function goToBreadcrumb(index: number) {
    setPath((prev) => prev.slice(0, index + 1));
  }

  function toggleFolder(item: GoogleDriveItem) {
    setSelectedFolders((prev) => {
      const next = new Map(prev);
      if (next.has(item.id)) next.delete(item.id);
      else next.set(item.id, item.name);
      return next;
    });
  }

  function toggleFile(item: GoogleDriveItem) {
    setSelectedFiles((prev) => {
      const next = new Map(prev);
      if (next.has(item.id)) {
        next.delete(item.id);
      } else {
        // "Il mio Drive" non è una vera cartella con un nome utile come
        // suggerimento di categoria --- solo una cartella vera lo è.
        const folderHint = currentFolder.id === "root" ? null : currentFolder.name;
        next.set(item.id, { name: item.name, mimeType: item.mimeType, folderHint });
      }
      return next;
    });
  }

  const selectionCount = selectedFolders.size + selectedFiles.size;
  const selectionSummary =
    selectedFolders.size > 0 && selectedFiles.size > 0
      ? `${selectedFolders.size} ${selectedFolders.size === 1 ? "cartella" : "cartelle"} + ${selectedFiles.size} ${selectedFiles.size === 1 ? "file" : "file"}`
      : selectedFolders.size > 0
        ? `${selectedFolders.size} ${selectedFolders.size === 1 ? "cartella" : "cartelle"}`
        : selectedFiles.size > 0
          ? `${selectedFiles.size} ${selectedFiles.size === 1 ? "file" : "file"}`
          : "Nessun elemento selezionato";

  async function handleConfirm() {
    if (!accessToken || selectionCount === 0) return;
    setResolving(true);
    setResolveError(null);
    try {
      const toDownload = await resolveDriveSelection(accessToken, {
        folders: Array.from(selectedFolders, ([id, name]) => ({ id, name })),
        files: Array.from(selectedFiles, ([id, v]) => ({ id, ...v })),
      });

      setDownloadProgress({ done: 0, total: toDownload.length });
      const downloaded: { file: File; folderHint: string | null }[] = [];
      for (const [index, item] of toDownload.entries()) {
        const file = await downloadGoogleDriveFile(accessToken, item);
        downloaded.push({ file, folderHint: item.folderHint });
        setDownloadProgress({ done: index + 1, total: toDownload.length });
      }
      onConfirm(downloaded);
    } catch (err) {
      setResolveError(err instanceof Error ? err.message : "Impossibile importare da Google Drive.");
      setResolving(false);
      setDownloadProgress(null);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 pt-[6vh]"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Importa da Google Drive"
        onClick={(e) => e.stopPropagation()}
        className="flex w-full max-w-2xl flex-col gap-4 rounded-2xl border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-800 dark:bg-zinc-950"
      >
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-brand">Importa da Google Drive</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Chiudi"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-zinc-200 text-zinc-500 hover:bg-zinc-100 dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-900"
          >
            ✕
          </button>
        </div>

        {authError ? (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {authError}
          </p>
        ) : !accessToken ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Connessione a Google Drive…</p>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-1 text-sm text-zinc-500 dark:text-zinc-400">
              {path.map((entry, index) => (
                <span key={entry.id} className="flex items-center gap-1">
                  {index > 0 ? <span className="text-zinc-300 dark:text-zinc-700">/</span> : null}
                  {index === path.length - 1 ? (
                    <span className="font-medium text-zinc-900 dark:text-zinc-100">{entry.name}</span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => goToBreadcrumb(index)}
                      className="hover:underline hover:text-brand"
                    >
                      {entry.name}
                    </button>
                  )}
                </span>
              ))}
            </div>

            {currentFolderIsFullySelected ? (
              <p className="rounded-lg bg-brand/5 px-3 py-2 text-xs text-brand">
                Questa cartella è selezionata per intero --- il suo contenuto verrà importato tutto,
                comprese le sottocartelle.
              </p>
            ) : null}

            {listError ? (
              <p role="alert" className="text-sm text-red-600 dark:text-red-400">
                {listError}
              </p>
            ) : null}

            <div className="flex max-h-80 flex-col gap-1 overflow-y-auto rounded-xl border border-zinc-200 p-2 dark:border-zinc-800">
              {items.length === 0 && !loadingItems ? (
                <p className="p-3 text-sm text-zinc-400 dark:text-zinc-600">Cartella vuota.</p>
              ) : (
                items.map((item) => {
                  const isSelected = item.isFolder
                    ? selectedFolders.has(item.id)
                    : selectedFiles.has(item.id);
                  return (
                    <div
                      key={item.id}
                      className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-zinc-50 dark:hover:bg-zinc-900"
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        disabled={!item.isFolder && currentFolderIsFullySelected}
                        onChange={() => (item.isFolder ? toggleFolder(item) : toggleFile(item))}
                        aria-label={`Seleziona ${item.name}`}
                        className="h-4 w-4 rounded border-zinc-300 text-brand focus:ring-brand dark:border-zinc-700"
                      />
                      {item.isFolder ? (
                        <button
                          type="button"
                          onClick={() => openFolder(item)}
                          className="min-w-0 flex-1 truncate text-left text-sm font-medium text-zinc-800 hover:text-brand dark:text-zinc-200"
                        >
                          📁 {item.name}
                        </button>
                      ) : (
                        <span className="min-w-0 flex-1 truncate text-sm text-zinc-700 dark:text-zinc-300">
                          📄 {item.name}
                        </span>
                      )}
                    </div>
                  );
                })
              )}
              {loadingItems ? (
                <p className="p-3 text-sm text-zinc-400 dark:text-zinc-600">Caricamento…</p>
              ) : null}
              {nextPageToken && !loadingItems ? (
                <button
                  type="button"
                  onClick={loadMore}
                  className="p-2 text-left text-xs font-medium text-brand hover:underline"
                >
                  Carica altri elementi…
                </button>
              ) : null}
            </div>

            {resolveError ? (
              <p role="alert" className="text-sm text-red-600 dark:text-red-400">
                {resolveError}
              </p>
            ) : null}

            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-zinc-500 dark:text-zinc-400">{selectionSummary}</span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
                >
                  Annulla
                </button>
                <button
                  type="button"
                  onClick={handleConfirm}
                  disabled={selectionCount === 0 || resolving}
                  className="rounded-xl bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-hover disabled:opacity-50"
                >
                  {downloadProgress
                    ? `Scaricamento… ${downloadProgress.done} di ${downloadProgress.total}`
                    : resolving
                      ? "Preparazione…"
                      : "Importa"}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
