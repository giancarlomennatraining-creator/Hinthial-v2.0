"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/db/supabase/client";
import { deleteAsset, listAssets, updateAsset } from "@/domain/assets/repository";
import { listDocuments } from "@/domain/documents/repository";
import { listCategories } from "@/domain/categories/repository";
import { listReminders } from "@/domain/reminders/repository";
import type { AssetListItem } from "@/domain/assets/types";
import type { DocumentListItem } from "@/domain/documents/types";
import type { Category } from "@/domain/categories/types";
import type { ReminderListItem } from "@/domain/reminders/types";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("it-IT", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function AssetsPanel({ masterKey }: { masterKey: CryptoKey }) {
  const supabase = useRef(createClient()).current;
  const router = useRouter();
  const searchParams = useSearchParams();

  const [categories, setCategories] = useState<Category[]>([]);
  const [assets, setAssets] = useState<AssetListItem[]>([]);
  const [documents, setDocuments] = useState<DocumentListItem[]>([]);
  const [reminders, setReminders] = useState<ReminderListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editCategoryId, setEditCategoryId] = useState("");

  // "?created=1" arriva da /assets/new dopo un salvataggio riuscito ---
  // v. CapsulesPanel.tsx per il motivo dello stato pigro qui sotto.
  const [showCreatedMessage] = useState(() => searchParams.get("created") === "1");
  useEffect(() => {
    if (showCreatedMessage) router.replace("/assets");
  }, [showCreatedMessage, router]);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const [categoriesResult, assetsResult, documentsResult, remindersResult] =
        await Promise.all([
          listCategories(supabase),
          listAssets(supabase, masterKey),
          listDocuments(supabase, masterKey),
          listReminders(supabase, masterKey),
        ]);
      setCategories(categoriesResult);
      setAssets(assetsResult);
      setDocuments(documentsResult);
      setReminders(remindersResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossibile caricare gli asset.");
    } finally {
      setLoading(false);
    }
  }, [supabase, masterKey]);

  useEffect(() => {
    // See DocumentsPanel.tsx for why fetch-on-mount is legitimate here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
  }, [refresh]);

  function startEditing(asset: AssetListItem) {
    setEditingId(asset.id);
    setEditName(asset.name);
    setEditCategoryId(asset.categoryId ?? "");
  }

  async function handleSaveEdit(asset: AssetListItem) {
    if (!editName.trim()) {
      setError("Il nome dell'asset non può essere vuoto.");
      return;
    }

    setBusyId(asset.id);
    setError(null);
    try {
      await updateAsset(supabase, masterKey, asset.id, {
        name: editName.trim(),
        categoryId: editCategoryId || null,
      });
      setEditingId(null);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossibile aggiornare l'asset.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(asset: AssetListItem) {
    if (
      !window.confirm(
        `Eliminare l'asset "${asset.name}"? I documenti e le scadenze collegati non verranno eliminati, solo scollegati.`,
      )
    )
      return;

    setBusyId(asset.id);
    setError(null);
    try {
      await deleteAsset(supabase, asset.id);
      setAssets((prev) => prev.filter((a) => a.id !== asset.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossibile eliminare l'asset.");
    } finally {
      setBusyId(null);
    }
  }

  function categoryFor(asset: AssetListItem): Category | undefined {
    return categories.find((c) => c.id === asset.categoryId);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
            Asset
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Censisci beni e contratti (casa, veicoli, assicurazioni, ...) e collega documenti e
            scadenze da Documenti e Scadenze.
          </p>
        </div>
        <Link
          href="/assets/new"
          className="shrink-0 rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-hover"
        >
          + Crea asset
        </Link>
      </div>

      {showCreatedMessage ? (
        <p className="text-sm text-lime-700 dark:text-lime-400">✅ Asset creato.</p>
      ) : null}

      {error ? (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Caricamento…</p>
      ) : assets.length === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-300 p-8 text-center dark:border-zinc-700">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Nessun asset ancora. Aggiungine uno col tasto qui sopra.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col divide-y divide-zinc-200 rounded-lg border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
          {assets.map((asset) => {
            const category = categoryFor(asset);
            const busy = busyId === asset.id;
            const isEditing = editingId === asset.id;
            const linkedDocuments = documents.filter((d) => d.relatedAssetId === asset.id);
            const linkedReminders = reminders.filter((r) => r.relatedAssetId === asset.id);

            if (isEditing) {
              return (
                <li key={asset.id} className="flex flex-col gap-3 p-4">
                  <div className="flex flex-wrap gap-3">
                    <div className="flex flex-1 min-w-[10rem] flex-col gap-1">
                      <label
                        htmlFor={`edit-${asset.id}-name`}
                        className="text-xs font-medium text-zinc-600 dark:text-zinc-400"
                      >
                        Nome
                      </label>
                      <input
                        id={`edit-${asset.id}-name`}
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label
                        htmlFor={`edit-${asset.id}-category`}
                        className="text-xs font-medium text-zinc-600 dark:text-zinc-400"
                      >
                        Categoria
                      </label>
                      <select
                        id={`edit-${asset.id}-category`}
                        value={editCategoryId}
                        onChange={(e) => setEditCategoryId(e.target.value)}
                        className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
                      >
                        <option value="">Nessuna categoria</option>
                        {categories.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.icon} {c.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => handleSaveEdit(asset)}
                      className="rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-hover disabled:opacity-50"
                    >
                      {busy ? "Salvataggio…" : "Salva"}
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => setEditingId(null)}
                      className="text-sm font-medium text-zinc-600 underline-offset-2 hover:underline dark:text-zinc-400"
                    >
                      Annulla
                    </button>
                  </div>
                </li>
              );
            }

            return (
              <li key={asset.id} className="flex flex-col gap-3 p-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
                      {asset.name}
                    </p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      {category ? `${category.icon} ${category.name} · ` : ""}
                      {formatDate(asset.createdAt)}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-3">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => startEditing(asset)}
                      className="text-sm font-medium text-zinc-600 underline-offset-2 hover:underline disabled:opacity-50 dark:text-zinc-400"
                    >
                      Modifica
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => handleDelete(asset)}
                      className="text-sm font-medium text-red-600 underline-offset-2 hover:underline disabled:opacity-50 dark:text-red-400"
                    >
                      Elimina
                    </button>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                      Documenti collegati
                    </p>
                    {linkedDocuments.length === 0 ? (
                      <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-600">Nessuno.</p>
                    ) : (
                      <ul className="mt-1 flex flex-col gap-0.5">
                        {linkedDocuments.map((doc) => (
                          <li key={doc.id} className="truncate text-xs text-zinc-700 dark:text-zinc-300">
                            📄 {doc.filename}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div>
                    <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                      Scadenze collegate
                    </p>
                    {linkedReminders.length === 0 ? (
                      <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-600">Nessuna.</p>
                    ) : (
                      <ul className="mt-1 flex flex-col gap-0.5">
                        {linkedReminders.map((reminder) => (
                          <li
                            key={reminder.id}
                            className="truncate text-xs text-zinc-700 dark:text-zinc-300"
                          >
                            ⏰ {reminder.title} · {formatDate(reminder.dueAt)}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
