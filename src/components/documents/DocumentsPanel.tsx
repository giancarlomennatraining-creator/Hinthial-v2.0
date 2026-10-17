"use client";

import { Fragment, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { bytesToUtf8 } from "@/lib/crypto";
import {
  documentsAwaitingExtraction,
  downloadDocument,
  extractTextForExistingDocument,
  updateTextNoteContent,
} from "@/domain/documents/repository";
import { contentKindFor, hasInlinePlayer } from "@/lib/content-kind";
import type { DocumentSummary } from "@/domain/documents/types";
import { formatDate, formatSize } from "@/lib/format";
import { sortAlphabetically } from "@/lib/utils";
import { MobileAddFab } from "@/components/ui/MobileAddFab";
import { PageHelp, type HelpTip } from "@/components/help/PageHelp";
import { ListSkeleton } from "@/components/ui/Skeleton";
import { RowActionsMenu, RowMenuItem } from "@/components/ui/RowActionsMenu";
import { ArchiveTabs } from "@/components/documents/ArchiveTabs";
import { AddContentMenu, ADD_CONTENT_ITEMS } from "@/components/documents/archive/parts";
import { PendingConfirmationNotice } from "@/components/documents/PendingConfirmationNotice";
import { useArchiveData } from "@/components/documents/archive/useArchiveData";
import { ContentTypeIcon } from "@/components/documents/ContentTypeIcon";
import { useToast } from "@/components/ui/ToastProvider";
import { BTN_PRIMARY, INPUT_FIELD } from "@/components/ui/styles";
import { EmptyListCard } from "@/components/ui/EmptyListCard";

const DAY_MS = 24 * 60 * 60 * 1000;

function expiryStatus(expiresAt: string | null): "none" | "overdue" | "soon" | "ok" {
  if (!expiresAt) return "none";
  const daysLeft = (new Date(expiresAt).getTime() - Date.now()) / DAY_MS;
  if (daysLeft < 0) return "overdue";
  if (daysLeft <= 30) return "soon";
  return "ok";
}

/** I consigli del tasto Aiuto di Archivio, uguali in tutte le viste. */
const ARCHIVE_HELP_TIPS: HelpTip[] = [
  { icon: "➕", text: "Aggiungi un contenuto nuovo, o trascinalo qui sopra." },
  { icon: "🔍", text: "Premi Ctrl+K per cercare in tutto Hinthial: per nome, note — o dentro ai documenti stessi." },
  { icon: "🏷️", text: "Filtra per categoria dal menu in alto." },
  { icon: "📂", text: "Passa a “Fascicolo” per raggruppare più contenuti insieme." },
];

/** "Archivio": documenti, immagini, audio, video e note testuali nella stessa lista con gli stessi attributi. Immagini/audio/video hanno un player inline (v. lib/content-kind.ts); una nota si apre e si modifica qui stesso. */
export function DocumentsPanel({ masterKey }: { masterKey: CryptoKey }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const showToast = useToast();

  const data = useArchiveData(masterKey);
  const {
    supabase,
    categories,
    dossiers,
    documents,
    loading,
    error,
    setError,
    refresh,
    busyDocId,
    selectedIds,
    toggleSelected,
    toggleSelectAll,
    clearSelection,
    bulkBusy,
    bulkPopover,
    setBulkPopover,
    handleOpen,
    handleDelete,
    handleBulkDelete,
    handleBulkCategory,
    handleBulkDossier,
    categoryFor,
    assetFor,
  } = data;
  const [categoryFilter, setCategoryFilter] = useState("");
  // Avanzamento della lettura dei documenti già archiviati; `fraction` è il progresso dentro il file corrente
  // (con l'OCR un singolo contenuto può occupare mezzo minuto, senza "3 di 7" resterebbe immobile).
  const [extractionProgress, setExtractionProgress] = useState<{
    done: number;
    total: number;
    fraction: number | null;
  } | null>(null);

  // Player inline per immagini/audio/video --- un solo elemento aperto alla volta.
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [playerUrl, setPlayerUrl] = useState<string | null>(null);
  const [playerLoading, setPlayerLoading] = useState(false);

  // Apertura/modifica di una nota testuale --- una sola alla volta.
  const [openNoteId, setOpenNoteId] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState({ title: "", body: "" });
  const [noteLoading, setNoteLoading] = useState(false);
  const [noteSaving, setNoteSaving] = useState(false);

  // "?created=1" arriva da /archive/new dopo un salvataggio riuscito. Niente più "?updated=1": la Scheda
  // (v. ArchiveItemDetail.tsx) salva sul posto, senza tornare qui --- il suo "Modifiche salvate." è un toast lì.
  const [showCreatedMessage] = useState(() => searchParams.get("created") === "1");
  useEffect(() => {
    if (showCreatedMessage) {
      showToast("Contenuto aggiunto.");
      router.replace("/archive");
    }
  }, [showCreatedMessage, router, showToast]);

  // Chiude sempre il player e libera l'object URL se il componente si smonta.
  useEffect(() => {
    return () => {
      if (playerUrl) URL.revokeObjectURL(playerUrl);
    };
  }, [playerUrl]);

  async function togglePlayer(doc: DocumentSummary) {
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

  async function toggleNote(doc: DocumentSummary) {
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

  async function saveNote(doc: DocumentSummary) {
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

  // Uno alla volta e non in parallelo: dieci letture insieme su un telefono lo farebbero solo arrancare.
  const pendingExtraction = documentsAwaitingExtraction(documents);

  async function handleExtractPending() {
    const queue = pendingExtraction;
    setExtractionProgress({ done: 0, total: queue.length, fraction: null });
    setError(null);

    let failures = 0;
    for (const [index, doc] of queue.entries()) {
      try {
        await extractTextForExistingDocument(supabase, masterKey, doc, (fraction) =>
          setExtractionProgress({ done: index, total: queue.length, fraction }),
        );
      } catch {
        // Un documento illeggibile non deve fermare gli altri: si conta e si prosegue.
        failures++;
      }
      setExtractionProgress({ done: index + 1, total: queue.length, fraction: null });
    }

    setExtractionProgress(null);
    await refresh();
    showToast(
      failures === 0
        ? "Lettura completata: ora puoi cercare dentro questi documenti."
        : `Lettura completata, ${failures} ${failures === 1 ? "documento" : "documenti"} non leggibili.`,
    );
  }

  const filteredDocuments = documents
    .filter((doc) => !categoryFilter || doc.categoryId === categoryFilter);

  return (
    <div className="flex flex-col gap-6 pb-[calc(3rem+env(safe-area-inset-bottom))] sm:pb-0">
      <div className="flex flex-col items-start gap-4 sm:flex-row sm:justify-between">
        <div className="min-w-0 w-full sm:flex-1">
          <div className="flex items-start justify-between gap-3">
            <h1 className="text-2xl font-semibold tracking-tight text-title">
              Archivio
            </h1>
            <PageHelp title="Archivio" tips={ARCHIVE_HELP_TIPS} />
          </div>
        </div>
        <AddContentMenu />
      </div>

      <ArchiveTabs />

      <MobileAddFab href="/archive/new" label="Aggiungi contenuto" menu={ADD_CONTENT_ITEMS} />

      <PendingConfirmationNotice existingIds={documents.map((d) => d.id)} />

      {error ? (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : null}

      {loading ? (
        <ListSkeleton />
      ) : documents.length === 0 ? (
        <EmptyListCard text="Ancora nulla in archivio." actionHref="/archive/new" actionLabel="Aggiungi il primo contenuto" />
      ) : (
        <>
          {/* Contenuti caricati prima che l'estrazione esistesse: non cercabili finché non letti. Compare solo se ce ne sono. */}
          {pendingExtraction.length > 0 ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-brand/30 bg-brand/5 p-4">
              <p className="min-w-0 text-sm text-zinc-700 dark:text-zinc-300">
                {extractionProgress
                  ? `Sto leggendo i documenti… ${Math.min(
                      extractionProgress.done + 1,
                      extractionProgress.total,
                    )} di ${extractionProgress.total}${
                      extractionProgress.fraction === null
                        ? ""
                        : ` — ${Math.round(extractionProgress.fraction * 100)}%`
                    }`
                  : `${pendingExtraction.length} ${
                      pendingExtraction.length === 1
                        ? "documento è stato caricato"
                        : "documenti sono stati caricati"
                    } prima che Hinthial sapesse leggerne il contenuto: ${
                      pendingExtraction.length === 1 ? "non è" : "non sono"
                    } ancora cercabili per quello che c'è scritto dentro.`}
              </p>
              <button
                type="button"
                disabled={extractionProgress !== null}
                onClick={handleExtractPending}
                className={`shrink-0 ${BTN_PRIMARY} disabled:opacity-50`}
              >
                {extractionProgress ? "Lettura in corso…" : "Leggili ora"}
              </button>
            </div>
          ) : null}

          <div className="flex flex-wrap gap-3">
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              aria-label="Filtra per categoria"
              className={INPUT_FIELD}
            >
              <option value="">Tutte le categorie</option>
              {sortAlphabetically(categories, (c) => c.name).map((category) => (
                <option key={category.id} value={category.id}>
                  {category.icon} {category.name}
                </option>
              ))}
            </select>
          </div>

          {/* Barra contestuale: compare solo con almeno un documento selezionato. */}
          {selectedIds.size > 0 ? (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-brand/10 px-3 py-1.5">
              <div className="flex items-center gap-2 text-sm font-semibold text-accent">
                <button
                  type="button"
                  onClick={clearSelection}
                  aria-label="Deseleziona tutto"
                  className="flex h-5 w-5 items-center justify-center rounded-full text-xs opacity-75 hover:bg-brand/20 hover:opacity-100"
                >
                  ✕
                </button>
                {selectedIds.size} {selectedIds.size === 1 ? "selezionato" : "selezionati"}
                {selectedIds.size < filteredDocuments.length ? (
                  <button
                    type="button"
                    onClick={() => toggleSelectAll(filteredDocuments.map((d) => d.id))}
                    className="font-medium underline underline-offset-2 hover:opacity-80"
                  >
                    Seleziona tutti ({filteredDocuments.length})
                  </button>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-1">
                <div className="relative">
                  <button
                    type="button"
                    disabled={bulkBusy}
                    onClick={() => setBulkPopover((prev) => (prev === "category" ? null : "category"))}
                    className="rounded-md px-2 py-1 text-sm font-semibold text-accent hover:bg-brand/20 disabled:opacity-50"
                  >
                    🏷️ Categoria
                  </button>
                  {bulkPopover === "category" ? (
                    <div className="absolute left-0 top-full z-20 mt-1 max-h-64 w-56 overflow-y-auto rounded-xl border border-zinc-200 bg-white p-1.5 shadow-lg dark:border-zinc-800 dark:bg-zinc-950">
                      {sortAlphabetically(categories, (c) => c.name).map((category) => (
                        <button
                          key={category.id}
                          type="button"
                          onClick={() => handleBulkCategory(category.id)}
                          className="block w-full rounded-md px-2.5 py-1.5 text-left text-sm text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-900"
                        >
                          {category.icon} {category.name}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
                <div className="relative">
                  <button
                    type="button"
                    disabled={bulkBusy || dossiers.length === 0}
                    onClick={() => setBulkPopover((prev) => (prev === "dossier" ? null : "dossier"))}
                    className="rounded-md px-2 py-1 text-sm font-semibold text-accent hover:bg-brand/20 disabled:opacity-50"
                  >
                    📁 Fascicolo
                  </button>
                  {bulkPopover === "dossier" ? (
                    <div className="absolute left-0 top-full z-20 mt-1 max-h-64 w-56 overflow-y-auto rounded-xl border border-zinc-200 bg-white p-1.5 shadow-lg dark:border-zinc-800 dark:bg-zinc-950">
                      {dossiers.map((dossier) => (
                        <button
                          key={dossier.id}
                          type="button"
                          onClick={() => handleBulkDossier(dossier.id)}
                          className="block w-full truncate rounded-md px-2.5 py-1.5 text-left text-sm text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-900"
                        >
                          {dossier.title}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
                <button
                  type="button"
                  disabled={bulkBusy}
                  onClick={handleBulkDelete}
                  className="rounded-md px-2 py-1 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50 dark:text-red-400 dark:hover:bg-red-950/40"
                >
                  🗑️ Elimina
                </button>
              </div>
            </div>
          ) : null}

          {filteredDocuments.length === 0 ? (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Nessun contenuto corrisponde ai filtri.
            </p>
          ) : (
            <ul className="flex flex-col divide-y divide-zinc-200 rounded-2xl border border-zinc-200 bg-white shadow-[0_8px_20px_rgba(16,24,40,0.04)] dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-950">
              {filteredDocuments.map((doc) => {
                const category = categoryFor(doc);
                const asset = assetFor(doc);
                const busy = busyDocId === doc.id;
                const status = expiryStatus(doc.expiresAt);
                const kind = contentKindFor(doc.mimeType);
                const isPlaying = playingId === doc.id;
                const isNoteOpen = openNoteId === doc.id;

                return (
                  <li key={doc.id} className="flex flex-col gap-3 p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex min-w-0 items-start gap-2">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(doc.id)}
                          onChange={() => toggleSelected(doc.id)}
                          aria-label={`Seleziona ${doc.filename}`}
                          className="mt-1 h-4 w-4 shrink-0 rounded border-zinc-300 text-accent focus:ring-brand dark:border-zinc-700"
                        />
                        <div className="min-w-0">
                        <Link
                          href={`/archive/${doc.id}`}
                          className="flex min-w-0 items-center gap-1 text-sm font-medium text-zinc-900 transition-colors hover:text-accent dark:text-zinc-100 dark:hover:text-blue-400"
                        >
                          <ContentTypeIcon kind={kind} inDossier={doc.dossierIds.length > 0} />
                          <span className="truncate">{doc.filename}</span>
                        </Link>
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
                      </div>
                      </div>
                      {/* Niente più "Modifica" qui: la Scheda (v. ArchiveItemDetail.tsx), raggiunta dal nome del
                          contenuto sopra, è già dove i metadati si modificano --- non serve una scorciatoia
                          duplicata verso la stessa pagina. */}
                      <RowActionsMenu label={`Azioni per ${doc.filename}`}>
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
                            Scarica
                          </RowMenuItem>
                        )}
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
                              className={INPUT_FIELD}
                            />
                            <div className="flex gap-3">
                              <button
                                type="button"
                                disabled={noteSaving}
                                onClick={() => saveNote(doc)}
                                className="self-start rounded-xl bg-brand px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-hover disabled:opacity-50"
                              >
                                {noteSaving ? "Salvataggio…" : "Salva nota"}
                              </button>
                            </div>
                          </>
                        )}
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
