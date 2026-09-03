"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/db/supabase/client";
import { listAssets, updateAsset } from "@/domain/assets/repository";
import { listCategories } from "@/domain/categories/repository";
import type { AssetListItem } from "@/domain/assets/types";
import type { Category } from "@/domain/categories/types";

/**
 * Pagina dedicata alla modifica di un asset --- prima era un form inline
 * nella riga di AssetsPanel, ora una pagina a sé come la creazione
 * (stesso pattern di conferma via `?updated=1`).
 */
export function EditAssetForm({ masterKey, assetId }: { masterKey: CryptoKey; assetId: string }) {
  const supabase = useRef(createClient()).current;
  const router = useRouter();

  const [asset, setAsset] = useState<AssetListItem | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const [assets, categoriesResult] = await Promise.all([
        listAssets(supabase, masterKey),
        listCategories(supabase),
      ]);
      setAsset(assets.find((a) => a.id === assetId) ?? null);
      setCategories(categoriesResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossibile caricare l'asset.");
    } finally {
      setLoading(false);
    }
  }, [supabase, masterKey, assetId]);

  useEffect(() => {
    // See DocumentsPanel.tsx for why fetch-on-mount is legitimate here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
  }, [refresh]);

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const form = event.currentTarget;
    const formData = new FormData(form);
    const name = String(formData.get("name") ?? "").trim();
    const categoryId = String(formData.get("categoryId") ?? "") || null;

    if (!name) {
      setError("Il nome dell'asset non può essere vuoto.");
      return;
    }

    setSaving(true);
    try {
      await updateAsset(supabase, masterKey, assetId, { name, categoryId });
      router.push("/assets?updated=1");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossibile aggiornare l'asset.");
      setSaving(false);
    }
  }

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <div>
        <Link
          href="/assets"
          className="text-sm font-medium text-zinc-500 underline-offset-2 hover:underline dark:text-zinc-400"
        >
          ← Torna agli asset
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
          Modifica asset
        </h1>
      </div>

      {loading ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Caricamento…</p>
      ) : !asset ? (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          Asset non trovato.
        </p>
      ) : (
        <form
          onSubmit={handleSave}
          className="flex flex-wrap items-end gap-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800"
        >
          <div className="flex flex-1 min-w-[10rem] flex-col gap-1">
            <label htmlFor="name" className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Nome
            </label>
            <input
              id="name"
              name="name"
              type="text"
              required
              defaultValue={asset.name}
              className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label
              htmlFor="categoryId"
              className="text-xs font-medium text-zinc-600 dark:text-zinc-400"
            >
              Categoria
            </label>
            <select
              id="categoryId"
              name="categoryId"
              defaultValue={asset.categoryId ?? ""}
              className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
            >
              <option value="">Nessuna categoria</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.icon} {category.name}
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
            disabled={saving}
            className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-hover disabled:opacity-50"
          >
            {saving ? "Salvataggio…" : "Salva modifiche"}
          </button>
          <Link
            href="/assets"
            className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
          >
            Annulla
          </Link>
        </form>
      )}
    </div>
  );
}
