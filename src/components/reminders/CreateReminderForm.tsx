"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useSupabase } from "@/lib/db/supabase/use-supabase";
import { createReminder } from "@/domain/reminders/repository";
import { listDocumentSummaries } from "@/domain/documents/repository";
import { listAssets } from "@/domain/assets/repository";
import { sortAlphabetically } from "@/lib/utils";
import type { DocumentSummary } from "@/domain/documents/types";
import type { AssetListItem } from "@/domain/assets/types";
import { BTN_PRIMARY, BTN_SECONDARY, INPUT_FIELD } from "@/components/ui/styles";

/**
 * Pagina dedicata alla creazione di una scadenza (estratta da
 * RemindersPanel). Stesso pattern usato per capsule/beni: alla
 * creazione riuscita torna a /reminders con un messaggio di conferma
 * passato come flag nell'URL (`?created=1`), mai il titolo --- finirebbe
 * in chiaro nella cronologia del browser.
 */
export function CreateReminderForm({ masterKey }: { masterKey: CryptoKey }) {
  const supabase = useSupabase();
  const router = useRouter();

  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  const [assets, setAssets] = useState<AssetListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  // Controllato (a differenza degli altri campi, letti da FormData al
  // submit) perché la selezione del bene filtra le opzioni del
  // documento collegato qui sotto.
  const [selectedAssetId, setSelectedAssetId] = useState("");

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const [documentsResult, assetsResult] = await Promise.all([
        listDocumentSummaries(supabase, masterKey),
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
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/reminders"
          className="text-sm font-medium text-zinc-500 underline-offset-2 hover:underline dark:text-zinc-400"
        >
          ← Torna alle scadenze
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-brand">
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
          className="flex flex-wrap items-end gap-3 rounded-2xl border border-zinc-200 bg-white shadow-[0_8px_20px_rgba(16,24,40,0.04)] p-4 dark:border-zinc-800 dark:bg-zinc-950"
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
              className={INPUT_FIELD}
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
              className={INPUT_FIELD}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label
              htmlFor="relatedAssetId"
              className="text-xs font-medium text-zinc-600 dark:text-zinc-400"
            >
              Bene collegato
            </label>
            <select
              id="relatedAssetId"
              name="relatedAssetId"
              value={selectedAssetId}
              onChange={(e) => setSelectedAssetId(e.target.value)}
              className={INPUT_FIELD}
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
              <option value="">{selectedAssetId ? "Nessuno" : "Scegli prima un bene"}</option>
              {/* Selezionare un bene filtra ai soli contenuti già collegati
                  a quel bene (v. Archivio) --- senza bene, nessun contenuto
                  è proponibile: la scelta del bene viene prima. */}
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
            className={`${BTN_PRIMARY} disabled:opacity-50`}
          >
            {creating ? "Creazione…" : "Aggiungi scadenza"}
          </button>
          <Link
            href="/reminders"
            className={BTN_SECONDARY}
          >
            Annulla
          </Link>
        </form>
      )}
    </div>
  );
}
