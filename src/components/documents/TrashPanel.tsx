"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/db/supabase/client";
import { deleteDocument, listTrashedDocuments, restoreDocuments } from "@/domain/documents/repository";
import { daysRemaining } from "@/domain/documents/trash";
import { formatDate } from "@/lib/format";
import { ArchiveTabs } from "@/components/documents/ArchiveTabs";
import { ListSkeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/ToastProvider";
import type { DocumentListItem } from "@/domain/documents/types";

/**
 * Cestino --- v. richiesta utente dopo la selezione multipla in
 * Archivio: eliminare più documenti insieme moltiplica il rischio di
 * un clic distratto, quindi l'eliminazione diventa reversibile per un
 * periodo di grazia (v. TrashRetentionSettings, Impostazioni ->
 * Aspetto) invece di immediata e definitiva. Un documento eliminato
 * per sempre da qui, o dal cron di purga (v.
 * app/api/cron/trash-purge), non torna più --- questa pagina è
 * l'ultima occasione di cambiare idea.
 */
export function TrashPanel({ masterKey }: { masterKey: CryptoKey }) {
  const supabase = useRef(createClient()).current;
  const showToast = useToast();

  const [documents, setDocuments] = useState<DocumentListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const refresh = useCallback(async () => {
    setError(null);
    try {
      setDocuments(await listTrashedDocuments(supabase, masterKey));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossibile caricare il cestino.");
    } finally {
      setLoading(false);
    }
  }, [supabase, masterKey]);

  useEffect(() => {
    // See DocumentsPanel.tsx for why fetch-on-mount is legitimate here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
  }, [refresh]);

  function toggleSelected(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    setSelectedIds((prev) => {
      const allSelected = documents.length > 0 && documents.every((d) => prev.has(d.id));
      return allSelected ? new Set() : new Set(documents.map((d) => d.id));
    });
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

  async function handleRestore(doc: DocumentListItem) {
    setBusyId(doc.id);
    setError(null);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Devi essere autenticato.");

      await restoreDocuments(supabase, user.id, [doc.id]);
      setDocuments((prev) => prev.filter((d) => d.id !== doc.id));
      showToast(`"${doc.filename}" ripristinato.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossibile ripristinare il documento.");
    } finally {
      setBusyId(null);
    }
  }

  async function handlePurgeNow(doc: DocumentListItem) {
    if (
      !window.confirm(`Eliminare "${doc.filename}" per sempre? Non potrai più ripristinarlo.`)
    )
      return;

    setBusyId(doc.id);
    setError(null);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Devi essere autenticato.");

      await deleteDocument(supabase, user.id, doc);
      setDocuments((prev) => prev.filter((d) => d.id !== doc.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossibile eliminare il documento.");
    } finally {
      setBusyId(null);
    }
  }

  const selectedDocuments = documents.filter((doc) => selectedIds.has(doc.id));

  async function handleBulkRestore() {
    const count = selectedDocuments.length;
    if (count === 0) return;
    setBulkBusy(true);
    setError(null);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Devi essere autenticato.");

      await restoreDocuments(supabase, user.id, selectedDocuments.map((d) => d.id));
      setDocuments((prev) => prev.filter((d) => !selectedIds.has(d.id)));
      clearSelection();
      showToast(`${count} ${count === 1 ? "documento ripristinato" : "documenti ripristinati"}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossibile ripristinare i documenti.");
    } finally {
      setBulkBusy(false);
    }
  }

  async function handleBulkPurge() {
    const count = selectedDocuments.length;
    if (count === 0) return;
    if (
      !window.confirm(
        `Eliminare per sempre ${count} ${count === 1 ? "documento" : "documenti"}? Non potrai più ripristinarli.`,
      )
    )
      return;

    setBulkBusy(true);
    setError(null);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Devi essere autenticato.");

      // Nessuna variante "in blocco" a livello di database qui, a
      // differenza dello spostamento nel cestino: ogni file cifrato va
      // rimosso singolarmente da Storage, non basta una sola UPDATE.
      for (const doc of selectedDocuments) {
        await deleteDocument(supabase, user.id, doc);
      }
      setDocuments((prev) => prev.filter((d) => !selectedIds.has(d.id)));
      clearSelection();
      showToast(`${count} ${count === 1 ? "documento eliminato" : "documenti eliminati"} per sempre.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossibile eliminare i documenti.");
    } finally {
      setBulkBusy(false);
    }
  }

  async function handleEmptyTrash() {
    if (documents.length === 0) return;
    if (
      !window.confirm(
        `Vuotare il cestino? Tutti i ${documents.length} documenti verranno eliminati per sempre.`,
      )
    )
      return;

    setBulkBusy(true);
    setError(null);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Devi essere autenticato.");

      for (const doc of documents) {
        await deleteDocument(supabase, user.id, doc);
      }
      setDocuments([]);
      clearSelection();
      showToast("Cestino vuotato.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossibile vuotare il cestino.");
    } finally {
      setBulkBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <ArchiveTabs />

      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-brand">🗑️ Cestino</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Un documento eliminato resta qui, recuperabile, per il periodo scelto in Impostazioni →
          Aspetto --- poi viene rimosso per sempre.
        </p>
      </div>

      {error ? (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : null}

      {loading ? (
        <ListSkeleton />
      ) : documents.length === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-300 p-8 text-center dark:border-zinc-700">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Il cestino è vuoto.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
              <input
                type="checkbox"
                checked={documents.length > 0 && documents.every((d) => selectedIds.has(d.id))}
                onChange={toggleSelectAll}
                aria-label="Seleziona tutti i documenti nel cestino"
                className="h-4 w-4 rounded border-zinc-300 text-brand focus:ring-brand dark:border-zinc-700"
              />
              {documents.length} {documents.length === 1 ? "documento" : "documenti"}
            </label>
            <button
              type="button"
              disabled={bulkBusy}
              onClick={handleEmptyTrash}
              className="text-sm font-medium text-red-600 hover:underline disabled:opacity-50 dark:text-red-400"
            >
              Vuota il cestino
            </button>
          </div>

          {selectedIds.size > 0 ? (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-brand/10 px-3 py-1.5">
              <div className="flex items-center gap-2 text-sm font-semibold text-brand">
                <button
                  type="button"
                  onClick={clearSelection}
                  aria-label="Deseleziona tutto"
                  className="flex h-5 w-5 items-center justify-center rounded-full text-xs opacity-75 hover:bg-brand/20 hover:opacity-100"
                >
                  ✕
                </button>
                {selectedIds.size} {selectedIds.size === 1 ? "selezionato" : "selezionati"}
              </div>
              <div className="flex gap-1">
                <button
                  type="button"
                  disabled={bulkBusy}
                  onClick={handleBulkRestore}
                  className="rounded-md px-2 py-1 text-sm font-semibold text-brand hover:bg-brand/20 disabled:opacity-50"
                >
                  ↩️ Ripristina selezionati
                </button>
                <button
                  type="button"
                  disabled={bulkBusy}
                  onClick={handleBulkPurge}
                  className="rounded-md px-2 py-1 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50 dark:text-red-400 dark:hover:bg-red-950/40"
                >
                  🗑️ Elimina ora
                </button>
              </div>
            </div>
          ) : null}

          <ul className="flex flex-col divide-y divide-zinc-200 rounded-2xl border border-zinc-200 bg-white shadow-[0_8px_20px_rgba(16,24,40,0.04)] dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-950">
            {documents.map((doc) => {
              const busy = busyId === doc.id;
              const remaining = doc.purgeAt ? daysRemaining(new Date(doc.purgeAt)) : null;
              return (
                <li key={doc.id} className="flex flex-wrap items-center gap-3 p-4">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(doc.id)}
                    onChange={() => toggleSelected(doc.id)}
                    aria-label={`Seleziona ${doc.filename}`}
                    className="h-4 w-4 shrink-0 rounded border-zinc-300 text-brand focus:ring-brand dark:border-zinc-700"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
                      📄 {doc.filename}
                    </p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      Eliminato il {doc.deletedAt ? formatDate(doc.deletedAt) : "—"}
                    </p>
                  </div>
                  {remaining !== null ? (
                    <span
                      className={
                        remaining <= 3
                          ? "shrink-0 rounded-full bg-orange-50 px-2.5 py-1 text-xs font-medium text-orange-700 dark:bg-orange-950 dark:text-orange-300"
                          : "shrink-0 rounded-full bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700 dark:bg-green-950 dark:text-green-300"
                      }
                    >
                      {remaining === 0
                        ? "in eliminazione"
                        : `${remaining} ${remaining === 1 ? "giorno" : "giorni"} rimasti`}
                    </span>
                  ) : null}
                  <div className="flex shrink-0 gap-1">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => handleRestore(doc)}
                      className="rounded-md px-2 py-1 text-sm font-medium text-brand hover:bg-brand/10 disabled:opacity-50"
                    >
                      ↩️ Ripristina
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => handlePurgeNow(doc)}
                      className="rounded-md px-2 py-1 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 dark:text-red-400 dark:hover:bg-red-950/40"
                    >
                      Elimina ora
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
