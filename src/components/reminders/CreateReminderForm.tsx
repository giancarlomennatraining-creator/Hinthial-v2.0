"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/db/supabase/client";
import { createReminder } from "@/domain/reminders/repository";
import { listDocuments } from "@/domain/documents/repository";
import { listAssets } from "@/domain/assets/repository";
import { sortAlphabetically } from "@/lib/utils";
import type { DocumentListItem } from "@/domain/documents/types";
import type { AssetListItem } from "@/domain/assets/types";

/**
 * Pagina dedicata alla creazione di una scadenza (estratta da
 * RemindersPanel). Stesso pattern usato per capsule/asset: alla
 * creazione riuscita torna a /reminders con un messaggio di conferma
 * passato come flag nell'URL (`?created=1`), mai il titolo --- finirebbe
 * in chiaro nella cronologia del browser.
 */
export function CreateReminderForm({ masterKey }: { masterKey: CryptoKey }) {
  const supabase = useRef(createClient()).current;
  const router = useRouter();

  const [documents, setDocuments] = useState<DocumentListItem[]>([]);
  const [assets, setAssets] = useState<AssetListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  // Controllato (a differenza degli altri campi, letti da FormData al
  // submit) perché la selezione dell'asset filtra le opzioni del
  // documento collegato qui sotto.
  const [selectedAssetId, setSelectedAssetId] = useState("");

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const [documentsResult, assetsResult] = await Promise.all([
        listDocuments(supabase, masterKey),
        listAssets(supabase, masterKey),
      ]);
      setDocuments(documentsResult);
      setAssets(assetsResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossibile caricare i dati necessari.");
    } finally {
      setLoading(false);
    }
  }, [supabase, masterKey]);

  useEffect(() => {
    // See DocumentsPanel.tsx for why fetch-on-mount is legitimate here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
  }, [refresh]);

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const form = event.currentTarget;
    const formData = new FormData(form);
    const title = String(formData.get("title") ?? "").trim();
    const dueAt = String(formData.get("dueAt") ?? "");
    const relatedDocumentId = String(formData.get("relatedDocumentId") ?? "") || null;
    const relatedAssetId = String(formData.get("relatedAssetId") ?? "") || null;

    if (!title || !dueAt) {
      setError("Inserisci almeno un titolo e una data.");
      return;
    }

    setCreating(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Devi essere autenticato.");

      await createReminder(supabase, masterKey, user.id, {
        title,
        dueAt: new Date(dueAt).toISOString(),
        relatedDocumentId,
        relatedAssetId,
      });
      router.push("/reminders?created=1");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossibile creare la scadenza.");
      setCreating(false);
    }
  }

  const sortedAssets = sortAlphabetically(assets, (asset) => asset.name);
  const sortedFilteredDocuments = selectedAssetId
    ? sortAlphabetically(
        documents.filter((doc) => doc.relatedAssetId === selectedAssetId),
        (doc) => doc.filename,
      )
    : [];

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <div>
        <Link
          href="/reminders"
          className="text-sm font-medium text-zinc-500 underline-offset-2 hover:underline dark:text-zinc-400"
        >
          ← Torna alle scadenze
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
          Nuova scadenza
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Promemoria per le date importanti, cifrati come tutto il resto.
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Caricamento…</p>
      ) : (
        <form
          onSubmit={handleCreate}
          className="flex flex-wrap items-end gap-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800"
        >
          <div className="flex flex-1 min-w-[10rem] flex-col gap-1">
            <label htmlFor="title" className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Titolo
            </label>
            <input
              id="title"
              name="title"
              type="text"
              required
              placeholder="es. Rinnovo assicurazione auto"
              className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="dueAt" className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Data
            </label>
            <input
              id="dueAt"
              name="dueAt"
              type="date"
              required
              className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label
              htmlFor="relatedAssetId"
              className="text-xs font-medium text-zinc-600 dark:text-zinc-400"
            >
              Asset collegato
            </label>
            <select
              id="relatedAssetId"
              name="relatedAssetId"
              value={selectedAssetId}
              onChange={(e) => setSelectedAssetId(e.target.value)}
              className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
            >
              <option value="">Nessuno</option>
              {sortedAssets.map((asset) => (
                <option key={asset.id} value={asset.id}>
                  {asset.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label
              htmlFor="relatedDocumentId"
              className="text-xs font-medium text-zinc-600 dark:text-zinc-400"
            >
              Contenuto collegato
            </label>
            <select
              id="relatedDocumentId"
              name="relatedDocumentId"
              disabled={!selectedAssetId}
              className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
            >
              <option value="">{selectedAssetId ? "Nessuno" : "Scegli prima un asset"}</option>
              {/* Selezionare un asset filtra ai soli contenuti già collegati
                  a quell'asset (v. Archivio) --- senza asset, nessun contenuto
                  è proponibile: la scelta dell'asset viene prima. */}
              {sortedFilteredDocuments.map((doc) => (
                <option key={doc.id} value={doc.id}>
                  {doc.filename}
                </option>
              ))}
            </select>
          </div>

          {error ? (
            <p role="alert" className="w-full text-sm text-red-600 dark:text-red-400">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={creating}
            className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-hover disabled:opacity-50"
          >
            {creating ? "Creazione…" : "Aggiungi scadenza"}
          </button>
          <Link
            href="/reminders"
            className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
          >
            Annulla
          </Link>
        </form>
      )}
    </div>
  );
}
