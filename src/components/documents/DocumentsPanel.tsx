"use client";

import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/db/supabase/client";
import { bytesToUtf8 } from "@/lib/crypto";
import {
  deleteDocument,
  downloadDocument,
  listDocuments,
  updateDocumentTranscript,
  updateTextNoteContent,
} from "@/domain/documents/repository";
import { listAssets } from "@/domain/assets/repository";
import { listCategories } from "@/domain/categories/repository";
import { contentKindFor, CONTENT_KIND_ICON, hasInlinePlayer, isTranscribable } from "@/lib/content-kind";
import { stubTranscriptionProvider } from "@/domain/transcription/stub-provider";
import type { DocumentListItem } from "@/domain/documents/types";
import type { AssetListItem } from "@/domain/assets/types";
import type { Category } from "@/domain/categories/types";
import { saveBytesAsFile } from "@/lib/download";
import { sortAlphabetically } from "@/lib/utils";
import { SearchInput } from "@/components/ui/SearchInput";
import { ListSkeleton } from "@/components/ui/Skeleton";
import { ListViewToggle } from "@/components/ui/ListViewToggle";
import { Pagination } from "@/components/ui/Pagination";
import { RowActionsMenu, RowMenuItem } from "@/components/ui/RowActionsMenu";
import { SortableColumnHeader } from "@/components/ui/SortableColumnHeader";
import { useListViewPreferences } from "@/components/layout/ListViewPreferencesProvider";
import { TABLE_PAGE_SIZE } from "@/lib/list-view";
import { applySort, toggleSort, type SortState } from "@/lib/table-sort";

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("it-IT", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

const DAY_MS = 24 * 60 * 60 * 1000;

function expiryStatus(expiresAt: string | null): "none" | "overdue" | "soon" | "ok" {
  if (!expiresAt) return "none";
  const daysLeft = (new Date(expiresAt).getTime() - Date.now()) / DAY_MS;
  if (daysLeft < 0) return "overdue";
  if (daysLeft <= 30) return "soon";
  return "ok";
}

type SortColumn = "name" | "category" | "asset" | "size" | "createdAt" | "expiresAt";

/**
 * FASE 14 --- "Archivio": documenti, immagini, audio, video e note
 * testuali, tutti nella stessa lista con gli stessi attributi
 * (categoria, asset, scadenza, tag, note). Immagini/audio/video hanno
 * un player inline (v. lib/content-kind.ts); una nota si apre e si
 * modifica qui stesso, senza scaricare nulla.
 */
export function DocumentsPanel({ masterKey }: { masterKey: CryptoKey }) {
  const supabase = useRef(createClient()).current;
  const router = useRouter();
  const searchParams = useSearchParams();

  const [categories, setCategories] = useState<Category[]>([]);
  const [assets, setAssets] = useState<AssetListItem[]>([]);
  const [documents, setDocuments] = useState<DocumentListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyDocId, setBusyDocId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<SortState<SortColumn> | null>({ key: "name", direction: "asc" });

  const { modeFor } = useListViewPreferences();
  const viewMode = modeFor("archive");

  // Player inline per immagini/audio/video --- un solo elemento aperto alla volta.
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [playerUrl, setPlayerUrl] = useState<string | null>(null);
  const [playerLoading, setPlayerLoading] = useState(false);

  // Apertura/modifica di una nota testuale --- una sola alla volta.
  const [openNoteId, setOpenNoteId] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState({ title: "", body: "" });
  const [noteLoading, setNoteLoading] = useState(false);
  const [noteSaving, setNoteSaving] = useState(false);

  // Trascrizione di un audio/video (v. domain/transcription) --- una sola alla volta.
  const [transcribingId, setTranscribingId] = useState<string | null>(null);
  const [transcriptDraft, setTranscriptDraft] = useState("");
  const [transcriptAutoMessage, setTranscriptAutoMessage] = useState<string | null>(null);
  const [transcriptAutoBusy, setTranscriptAutoBusy] = useState(false);
  const [transcriptSaving, setTranscriptSaving] = useState(false);

  // "?created=1"/"?updated=1" arrivano da /archive/new e da
  // /archive/[id]/edit dopo un salvataggio riuscito --- v.
  // CapsulesPanel.tsx per il motivo dello stato pigro qui sotto.
  const [showCreatedMessage] = useState(() => searchParams.get("created") === "1");
  const [showUpdatedMessage] = useState(() => searchParams.get("updated") === "1");
  useEffect(() => {
    if (showCreatedMessage || showUpdatedMessage) router.replace("/archive");
  }, [showCreatedMessage, showUpdatedMessage, router]);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const [categoriesResult, assetsResult, documentsResult] = await Promise.all([
        listCategories(supabase),
        listAssets(supabase, masterKey),
        listDocuments(supabase, masterKey),
      ]);
      setCategories(categoriesResult);
      setAssets(assetsResult);
      setDocuments(documentsResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossibile caricare l'archivio.");
    } finally {
      setLoading(false);
    }
  }, [supabase, masterKey]);

  useEffect(() => {
    // Fetching + client-side decryption on mount is legitimate here (not
    // the "derive state from props" anti-pattern this rule targets):
    // the data can only be read/decrypted with the in-memory masterKey,
    // so it can't come from a Server Component.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
  }, [refresh]);

  // Chiude sempre il player e libera l'object URL se il componente si smonta.
  useEffect(() => {
    return () => {
      if (playerUrl) URL.revokeObjectURL(playerUrl);
    };
  }, [playerUrl]);

  async function handleOpen(doc: DocumentListItem) {
    setBusyDocId(doc.id);
    setError(null);
    try {
      const { filename, mimeType, bytes } = await downloadDocument(supabase, masterKey, doc);
      saveBytesAsFile(bytes, filename, mimeType);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossibile aprire il contenuto.");
    } finally {
      setBusyDocId(null);
    }
  }

  async function togglePlayer(doc: DocumentListItem) {
    if (playingId === doc.id) {
      if (playerUrl) URL.revokeObjectURL(playerUrl);
      setPlayingId(null);
      setPlayerUrl(null);
      return;
    }

    if (playerUrl) URL.revokeObjectURL(playerUrl);
    setPlayingId(doc.id);
    setPlayerUrl(null);
    setPlayerLoading(true);
    setError(null);
    try {
      const { mimeType, bytes } = await downloadDocument(supabase, masterKey, doc);
      const blob = new Blob([new Uint8Array(bytes)], { type: mimeType });
      setPlayerUrl(URL.createObjectURL(blob));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossibile riprodurre il contenuto.");
      setPlayingId(null);
    } finally {
      setPlayerLoading(false);
    }
  }

  async function toggleNote(doc: DocumentListItem) {
    if (openNoteId === doc.id) {
      setOpenNoteId(null);
      return;
    }

    setOpenNoteId(doc.id);
    setNoteLoading(true);
    setError(null);
    try {
      const { bytes } = await downloadDocument(supabase, masterKey, doc);
      setNoteDraft({ title: doc.filename, body: bytesToUtf8(bytes) });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossibile aprire la nota.");
      setOpenNoteId(null);
    } finally {
      setNoteLoading(false);
    }
  }

  async function saveNote(doc: DocumentListItem) {
    if (!noteDraft.title.trim()) {
      setError("Inserisci un titolo per la nota.");
      return;
    }

    setNoteSaving(true);
    setError(null);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Devi essere autenticato.");

      await updateTextNoteContent(supabase, masterKey, user.id, doc, {
        title: noteDraft.title.trim(),
        body: noteDraft.body,
      });
      setOpenNoteId(null);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossibile aggiornare la nota.");
    } finally {
      setNoteSaving(false);
    }
  }

  function toggleTranscript(doc: DocumentListItem) {
    if (transcribingId === doc.id) {
      setTranscribingId(null);
      return;
    }
    setTranscribingId(doc.id);
    setTranscriptDraft(doc.transcript);
    setTranscriptAutoMessage(null);
  }

  async function handleAutoTranscribe(doc: DocumentListItem) {
    setTranscriptAutoMessage(null);
    setTranscriptAutoBusy(true);
    setError(null);
    try {
      const { mimeType, bytes } = await downloadDocument(supabase, masterKey, doc);
      const result = await stubTranscriptionProvider.transcribe(bytes, mimeType);
      if (result) {
        setTranscriptDraft(result);
      } else {
        setTranscriptAutoMessage(
          "La trascrizione automatica non è ancora disponibile in questa versione (arriverà con l'AI reale, in un motore che gira interamente sul dispositivo). Scrivila tu qui sotto, nel frattempo.",
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossibile leggere il contenuto da trascrivere.");
    } finally {
      setTranscriptAutoBusy(false);
    }
  }

  async function saveTranscript(doc: DocumentListItem) {
    setTranscriptSaving(true);
    setError(null);
    try {
      await updateDocumentTranscript(supabase, masterKey, doc.id, transcriptDraft);
      // refresh() prima di chiudere il pannello: se lo si riapre subito
      // dopo, deve già trovare il testo appena salvato, non quello di
      // prima (v. lo stesso ordine in saveAttachmentTranscript, CapsulesPanel.tsx).
      await refresh();
      setTranscribingId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossibile salvare la trascrizione.");
    } finally {
      setTranscriptSaving(false);
    }
  }

  async function handleDelete(doc: DocumentListItem) {
    if (!window.confirm(`Eliminare "${doc.filename}"? L'operazione non è reversibile.`)) return;

    setBusyDocId(doc.id);
    setError(null);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Devi essere autenticato.");

      await deleteDocument(supabase, user.id, doc);
      setDocuments((prev) => prev.filter((d) => d.id !== doc.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossibile eliminare il contenuto.");
    } finally {
      setBusyDocId(null);
    }
  }

  function categoryFor(doc: DocumentListItem): Category | undefined {
    return categories.find((c) => c.id === doc.categoryId);
  }

  function assetFor(doc: DocumentListItem): AssetListItem | undefined {
    return assets.find((a) => a.id === doc.relatedAssetId);
  }

  function sortValueFor(doc: DocumentListItem, column: SortColumn): string {
    switch (column) {
      case "name":
        return doc.filename;
      case "category":
        return categoryFor(doc)?.name ?? "";
      case "asset":
        return assetFor(doc)?.name ?? "";
      case "size":
        return formatSize(doc.size);
      case "createdAt":
        return formatDate(doc.createdAt);
      case "expiresAt":
        return doc.expiresAt ? formatDate(doc.expiresAt) : "";
    }
  }

  function handleSort(column: SortColumn) {
    setSort((prev) => toggleSort(prev, column));
  }

  function matchesQuery(doc: DocumentListItem): boolean {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return true;
    const haystack = [doc.filename, doc.notes, doc.transcript, ...doc.tags].join(" ").toLowerCase();
    return haystack.includes(normalized);
  }

  const filteredDocuments = documents
    .filter(matchesQuery)
    .filter((doc) => !categoryFilter || doc.categoryId === categoryFilter);

  // L'ordinamento (solo click su un'intestazione, quindi solo in
  // modalità tabellare) non tocca filteredDocuments stesso: la vista a
  // elenco resta nel suo ordine cronologico abituale.
  const sortedDocuments = applySort(filteredDocuments, sort, sortValueFor);

  // Si riclampa invece di resettare con un effect: se un filtro riduce i
  // risultati, la pagina torna da sola entro il range valido.
  const pageCount = Math.max(1, Math.ceil(filteredDocuments.length / TABLE_PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pagedDocuments = sortedDocuments.slice(
    (currentPage - 1) * TABLE_PAGE_SIZE,
    currentPage * TABLE_PAGE_SIZE,
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
            Archivio
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Documenti, immagini, audio, video e note --- tutto cifrato sul tuo dispositivo prima
            di essere salvato.
          </p>
        </div>
        <Link
          href="/archive/new"
          className="shrink-0 rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-hover"
        >
          + Aggiungi contenuto
        </Link>
      </div>

      {showCreatedMessage ? (
        <p className="text-sm text-lime-700 dark:text-lime-400">✅ Contenuto aggiunto.</p>
      ) : null}
      {showUpdatedMessage ? (
        <p className="text-sm text-lime-700 dark:text-lime-400">✅ Contenuto aggiornato.</p>
      ) : null}

      {error ? (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : null}

      {loading ? (
        <ListSkeleton />
      ) : documents.length === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-300 p-8 text-center dark:border-zinc-700">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Ancora nulla in archivio. Aggiungi il tuo primo contenuto col tasto qui sopra.
          </p>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-3">
            <SearchInput
              value={query}
              onChange={setQuery}
              placeholder="Cerca per nome, tag, note o trascrizione…"
            />
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              aria-label="Filtra per categoria"
              className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
            >
              <option value="">Tutte le categorie</option>
              {sortAlphabetically(categories, (c) => c.name).map((category) => (
                <option key={category.id} value={category.id}>
                  {category.icon} {category.name}
                </option>
              ))}
            </select>
            <ListViewToggle section="archive" />
          </div>

          {filteredDocuments.length === 0 ? (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Nessun contenuto corrisponde alla ricerca.
            </p>
          ) : viewMode === "table" ? (
            <div className="flex flex-col gap-3">
              <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-200 text-left text-xs font-medium text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                      <SortableColumnHeader label="Nome" sortKey="name" sort={sort} onSort={handleSort} />
                      <SortableColumnHeader
                        label="Categoria"
                        sortKey="category"
                        sort={sort}
                        onSort={handleSort}
                      />
                      <SortableColumnHeader label="Asset" sortKey="asset" sort={sort} onSort={handleSort} />
                      <SortableColumnHeader
                        label="Dimensione"
                        sortKey="size"
                        sort={sort}
                        onSort={handleSort}
                      />
                      <SortableColumnHeader
                        label="Creato il"
                        sortKey="createdAt"
                        sort={sort}
                        onSort={handleSort}
                      />
                      <SortableColumnHeader
                        label="Scadenza"
                        sortKey="expiresAt"
                        sort={sort}
                        onSort={handleSort}
                      />
                      <th className="p-3">Azioni</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                    {pagedDocuments.map((doc) => {
                      const category = categoryFor(doc);
                      const asset = assetFor(doc);
                      const busy = busyDocId === doc.id;
                      const status = expiryStatus(doc.expiresAt);
                      const kind = contentKindFor(doc.mimeType);
                      const isPlaying = playingId === doc.id;
                      const isNoteOpen = openNoteId === doc.id;
                      const isTranscribing = transcribingId === doc.id;
                      const isExpanded = isPlaying || isNoteOpen || isTranscribing;

                      return (
                        <Fragment key={doc.id}>
                          <tr>
                            <td className="max-w-[16rem] truncate p-3 font-medium text-zinc-900 dark:text-zinc-100">
                              {CONTENT_KIND_ICON[kind]} {doc.filename}
                            </td>
                            <td className="p-3 text-zinc-600 dark:text-zinc-400">
                              {category ? `${category.icon} ${category.name}` : "—"}
                            </td>
                            <td className="p-3 text-zinc-600 dark:text-zinc-400">
                              {asset ? asset.name : "—"}
                            </td>
                            <td className="p-3 text-zinc-600 dark:text-zinc-400">
                              {formatSize(doc.size)}
                            </td>
                            <td className="p-3 text-zinc-600 dark:text-zinc-400">
                              {formatDate(doc.createdAt)}
                            </td>
                            <td className="p-3">
                              {doc.expiresAt ? (
                                <span
                                  className={
                                    status === "overdue"
                                      ? "font-medium text-red-600 dark:text-red-400"
                                      : status === "soon"
                                        ? "font-medium text-orange-600 dark:text-orange-400"
                                        : "text-zinc-600 dark:text-zinc-400"
                                  }
                                >
                                  {formatDate(doc.expiresAt)}
                                </span>
                              ) : (
                                <span className="text-zinc-600 dark:text-zinc-400">—</span>
                              )}
                            </td>
                            <td className="p-3">
                              <RowActionsMenu label={`Azioni per ${doc.filename}`}>
                                <RowMenuItem disabled={busy} onClick={() => router.push(`/archive/${doc.id}/edit`)}>
                                  Modifica
                                </RowMenuItem>
                                {kind === "note" ? (
                                  <RowMenuItem disabled={busy} onClick={() => toggleNote(doc)}>
                                    {isNoteOpen ? "Chiudi" : "Apri"}
                                  </RowMenuItem>
                                ) : hasInlinePlayer(kind) ? (
                                  <>
                                    <RowMenuItem disabled={busy} onClick={() => togglePlayer(doc)}>
                                      {isPlaying ? "Nascondi" : "Riproduci"}
                                    </RowMenuItem>
                                    <RowMenuItem disabled={busy} onClick={() => handleOpen(doc)}>
                                      Scarica
                                    </RowMenuItem>
                                  </>
                                ) : (
                                  <RowMenuItem disabled={busy} onClick={() => handleOpen(doc)}>
                                    Apri
                                  </RowMenuItem>
                                )}
                                {isTranscribable(kind) ? (
                                  <RowMenuItem disabled={busy} onClick={() => toggleTranscript(doc)}>
                                    {isTranscribing ? "Chiudi trascrizione" : "📝 Trascrizione"}
                                  </RowMenuItem>
                                ) : null}
                                <RowMenuItem disabled={busy} danger onClick={() => handleDelete(doc)}>
                                  Elimina
                                </RowMenuItem>
                              </RowActionsMenu>
                            </td>
                          </tr>
                          {isExpanded ? (
                            <tr>
                              <td colSpan={7} className="p-4">
                                {isPlaying ? (
                                  <div className="rounded-md bg-zinc-50 p-3 dark:bg-zinc-900">
                                    {playerLoading || !playerUrl ? (
                                      <p className="text-xs text-zinc-500 dark:text-zinc-400">
                                        Caricamento…
                                      </p>
                                    ) : kind === "image" ? (
                                      // eslint-disable-next-line @next/next/no-img-element -- object URL locale, decifrata sul dispositivo
                                      <img
                                        src={playerUrl}
                                        alt={doc.filename}
                                        className="max-h-96 max-w-full rounded-md"
                                      />
                                    ) : kind === "video" ? (
                                      <video src={playerUrl} controls className="max-h-96 max-w-full rounded-md" />
                                    ) : (
                                      <audio src={playerUrl} controls className="w-full" />
                                    )}
                                  </div>
                                ) : isNoteOpen ? (
                                  <div className="flex flex-col gap-2 rounded-md bg-zinc-50 p-3 dark:bg-zinc-900">
                                    {noteLoading ? (
                                      <p className="text-xs text-zinc-500 dark:text-zinc-400">Caricamento…</p>
                                    ) : (
                                      <>
                                        <input
                                          type="text"
                                          value={noteDraft.title}
                                          onChange={(e) =>
                                            setNoteDraft((prev) => ({ ...prev, title: e.target.value }))
                                          }
                                          aria-label="Titolo della nota"
                                          className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-950 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
                                        />
                                        <textarea
                                          rows={6}
                                          value={noteDraft.body}
                                          onChange={(e) =>
                                            setNoteDraft((prev) => ({ ...prev, body: e.target.value }))
                                          }
                                          aria-label="Testo della nota"
                                          className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
                                        />
                                        <div className="flex gap-3">
                                          <button
                                            type="button"
                                            disabled={noteSaving}
                                            onClick={() => saveNote(doc)}
                                            className="self-start rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-hover disabled:opacity-50"
                                          >
                                            {noteSaving ? "Salvataggio…" : "Salva nota"}
                                          </button>
                                        </div>
                                      </>
                                    )}
                                  </div>
                                ) : isTranscribing ? (
                                  <div className="flex flex-col gap-2 rounded-md bg-zinc-50 p-3 dark:bg-zinc-900">
                                    <div className="flex items-center justify-between gap-3">
                                      <label
                                        htmlFor={`transcript-${doc.id}`}
                                        className="text-xs font-medium text-zinc-600 dark:text-zinc-400"
                                      >
                                        Trascrizione
                                      </label>
                                      <button
                                        type="button"
                                        disabled={transcriptAutoBusy}
                                        onClick={() => handleAutoTranscribe(doc)}
                                        className="text-xs font-medium text-zinc-600 underline-offset-2 hover:underline disabled:opacity-50 dark:text-zinc-400"
                                      >
                                        {transcriptAutoBusy ? "Provo…" : "Trascrivi automaticamente"}
                                      </button>
                                    </div>
                                    {transcriptAutoMessage ? (
                                      <p className="text-xs text-zinc-500 dark:text-zinc-400">
                                        {transcriptAutoMessage}
                                      </p>
                                    ) : null}
                                    <textarea
                                      id={`transcript-${doc.id}`}
                                      rows={5}
                                      value={transcriptDraft}
                                      onChange={(e) => setTranscriptDraft(e.target.value)}
                                      placeholder="Scrivi qui la trascrizione, o provaci con il tasto qui sopra…"
                                      className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
                                    />
                                    <div className="flex gap-3">
                                      <button
                                        type="button"
                                        disabled={transcriptSaving}
                                        onClick={() => saveTranscript(doc)}
                                        className="self-start rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-hover disabled:opacity-50"
                                      >
                                        {transcriptSaving ? "Salvataggio…" : "Salva trascrizione"}
                                      </button>
                                    </div>
                                  </div>
                                ) : null}
                              </td>
                            </tr>
                          ) : null}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <Pagination page={currentPage} pageCount={pageCount} onChange={setPage} />
            </div>
          ) : (
            <ul className="flex flex-col divide-y divide-zinc-200 rounded-lg border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
              {filteredDocuments.map((doc) => {
                const category = categoryFor(doc);
                const asset = assetFor(doc);
                const busy = busyDocId === doc.id;
                const status = expiryStatus(doc.expiresAt);
                const kind = contentKindFor(doc.mimeType);
                const isPlaying = playingId === doc.id;
                const isNoteOpen = openNoteId === doc.id;
                const isTranscribing = transcribingId === doc.id;

                return (
                  <li key={doc.id} className="flex flex-col gap-3 p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
                          {CONTENT_KIND_ICON[kind]} {doc.filename}
                        </p>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">
                          {category ? `${category.icon} ${category.name} · ` : ""}
                          {asset ? `🔗 ${asset.name} · ` : ""}
                          {formatSize(doc.size)} · {formatDate(doc.createdAt)}
                          {doc.expiresAt ? (
                            <>
                              {" · "}
                              <span
                                className={
                                  status === "overdue"
                                    ? "font-medium text-red-600 dark:text-red-400"
                                    : status === "soon"
                                      ? "font-medium text-orange-600 dark:text-orange-400"
                                      : ""
                                }
                              >
                                scade {formatDate(doc.expiresAt)}
                              </span>
                            </>
                          ) : null}
                        </p>
                        {doc.tags.length > 0 ? (
                          <div className="mt-1.5 flex flex-wrap gap-1">
                            {doc.tags.map((tag) => (
                              <span
                                key={tag}
                                className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        ) : null}
                      </div>
                      <RowActionsMenu label={`Azioni per ${doc.filename}`}>
                        <RowMenuItem disabled={busy} onClick={() => router.push(`/archive/${doc.id}/edit`)}>
                          Modifica
                        </RowMenuItem>
                        {kind === "note" ? (
                          <RowMenuItem disabled={busy} onClick={() => toggleNote(doc)}>
                            {isNoteOpen ? "Chiudi" : "Apri"}
                          </RowMenuItem>
                        ) : hasInlinePlayer(kind) ? (
                          <>
                            <RowMenuItem disabled={busy} onClick={() => togglePlayer(doc)}>
                              {isPlaying ? "Nascondi" : "Riproduci"}
                            </RowMenuItem>
                            <RowMenuItem disabled={busy} onClick={() => handleOpen(doc)}>
                              Scarica
                            </RowMenuItem>
                          </>
                        ) : (
                          <RowMenuItem disabled={busy} onClick={() => handleOpen(doc)}>
                            Apri
                          </RowMenuItem>
                        )}
                        {isTranscribable(kind) ? (
                          <RowMenuItem disabled={busy} onClick={() => toggleTranscript(doc)}>
                            {isTranscribing ? "Chiudi trascrizione" : "📝 Trascrizione"}
                          </RowMenuItem>
                        ) : null}
                        <RowMenuItem disabled={busy} danger onClick={() => handleDelete(doc)}>
                          Elimina
                        </RowMenuItem>
                      </RowActionsMenu>
                    </div>

                    {isPlaying ? (
                      <div className="rounded-md bg-zinc-50 p-3 dark:bg-zinc-900">
                        {playerLoading || !playerUrl ? (
                          <p className="text-xs text-zinc-500 dark:text-zinc-400">Caricamento…</p>
                        ) : kind === "image" ? (
                          // eslint-disable-next-line @next/next/no-img-element -- object URL locale, decifrata sul dispositivo
                          <img src={playerUrl} alt={doc.filename} className="max-h-96 max-w-full rounded-md" />
                        ) : kind === "video" ? (
                          <video src={playerUrl} controls className="max-h-96 max-w-full rounded-md" />
                        ) : (
                          <audio src={playerUrl} controls className="w-full" />
                        )}
                      </div>
                    ) : null}

                    {isNoteOpen ? (
                      <div className="flex flex-col gap-2 rounded-md bg-zinc-50 p-3 dark:bg-zinc-900">
                        {noteLoading ? (
                          <p className="text-xs text-zinc-500 dark:text-zinc-400">Caricamento…</p>
                        ) : (
                          <>
                            <input
                              type="text"
                              value={noteDraft.title}
                              onChange={(e) => setNoteDraft((prev) => ({ ...prev, title: e.target.value }))}
                              aria-label="Titolo della nota"
                              className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-950 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
                            />
                            <textarea
                              rows={6}
                              value={noteDraft.body}
                              onChange={(e) => setNoteDraft((prev) => ({ ...prev, body: e.target.value }))}
                              aria-label="Testo della nota"
                              className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
                            />
                            <div className="flex gap-3">
                              <button
                                type="button"
                                disabled={noteSaving}
                                onClick={() => saveNote(doc)}
                                className="self-start rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-hover disabled:opacity-50"
                              >
                                {noteSaving ? "Salvataggio…" : "Salva nota"}
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    ) : null}

                    {isTranscribing ? (
                      <div className="flex flex-col gap-2 rounded-md bg-zinc-50 p-3 dark:bg-zinc-900">
                        <div className="flex items-center justify-between gap-3">
                          <label
                            htmlFor={`transcript-${doc.id}`}
                            className="text-xs font-medium text-zinc-600 dark:text-zinc-400"
                          >
                            Trascrizione
                          </label>
                          <button
                            type="button"
                            disabled={transcriptAutoBusy}
                            onClick={() => handleAutoTranscribe(doc)}
                            className="text-xs font-medium text-zinc-600 underline-offset-2 hover:underline disabled:opacity-50 dark:text-zinc-400"
                          >
                            {transcriptAutoBusy ? "Provo…" : "Trascrivi automaticamente"}
                          </button>
                        </div>
                        {transcriptAutoMessage ? (
                          <p className="text-xs text-zinc-500 dark:text-zinc-400">{transcriptAutoMessage}</p>
                        ) : null}
                        <textarea
                          id={`transcript-${doc.id}`}
                          rows={5}
                          value={transcriptDraft}
                          onChange={(e) => setTranscriptDraft(e.target.value)}
                          placeholder="Scrivi qui la trascrizione, o provaci con il tasto qui sopra…"
                          className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
                        />
                        <div className="flex gap-3">
                          <button
                            type="button"
                            disabled={transcriptSaving}
                            onClick={() => saveTranscript(doc)}
                            className="self-start rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-hover disabled:opacity-50"
                          >
                            {transcriptSaving ? "Salvataggio…" : "Salva trascrizione"}
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
