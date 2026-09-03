"use client";

import { sortAlphabetically } from "@/lib/utils";
import type { Category } from "@/domain/categories/types";
import type { AssetListItem } from "@/domain/assets/types";

export interface DocumentMetadataFieldsValue {
  categoryId: string;
  relatedAssetId: string;
  /** yyyy-mm-dd, or "" for no expiry. */
  expiresAt: string;
  notes: string;
  /** comma-separated, parsed via parseTagsInput. */
  tagsInput: string;
}

export const EMPTY_METADATA_FIELDS: DocumentMetadataFieldsValue = {
  categoryId: "",
  relatedAssetId: "",
  expiresAt: "",
  notes: "",
  tagsInput: "",
};

export function parseTagsInput(input: string): string[] {
  return input
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

export function DocumentMetadataFields({
  idPrefix,
  categories,
  assets,
  value,
  onChange,
  showExpiry = true,
}: {
  idPrefix: string;
  categories: Category[];
  assets: AssetListItem[];
  value: DocumentMetadataFieldsValue;
  onChange: (next: DocumentMetadataFieldsValue) => void;
  /**
   * In creazione raramente si conosce già la scadenza esatta (e per
   * audio/video/note spesso non ha proprio senso chiederla) --- il
   * campo va aggiunto dopo, via "Modifica", una volta che si sa
   * davvero (a mano, o in futuro suggerito dall'AI reale che legge il
   * contenuto). Di default true per non rompere l'uso in modifica.
   */
  showExpiry?: boolean;
}) {
  // La categoria filtra gli asset proposti (es. "Casa" -> solo gli asset
  // di categoria "Casa") --- senza categoria selezionata, nessun asset è
  // proponibile: la scelta della categoria viene prima.
  const filteredAssets = value.categoryId
    ? sortAlphabetically(
        assets.filter((asset) => asset.categoryId === value.categoryId),
        (asset) => asset.name,
      )
    : [];

  function handleCategoryChange(categoryId: string) {
    // Se l'asset già selezionato non appartiene alla nuova categoria,
    // deseleziona: l'elenco che sta per essere mostrato non lo conterrebbe.
    const nextAssets = categoryId ? assets.filter((asset) => asset.categoryId === categoryId) : [];
    const relatedAssetId = nextAssets.some((asset) => asset.id === value.relatedAssetId)
      ? value.relatedAssetId
      : "";
    onChange({ ...value, categoryId, relatedAssetId });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-3">
        <div className="flex flex-col gap-1">
          <label
            htmlFor={`${idPrefix}-category`}
            className="text-xs font-medium text-zinc-600 dark:text-zinc-400"
          >
            Categoria
          </label>
          <select
            id={`${idPrefix}-category`}
            value={value.categoryId}
            onChange={(e) => handleCategoryChange(e.target.value)}
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

        <div className="flex flex-col gap-1">
          <label
            htmlFor={`${idPrefix}-asset`}
            className="text-xs font-medium text-zinc-600 dark:text-zinc-400"
          >
            Asset collegato
          </label>
          <select
            id={`${idPrefix}-asset`}
            value={value.relatedAssetId}
            onChange={(e) => onChange({ ...value, relatedAssetId: e.target.value })}
            disabled={!value.categoryId}
            className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
          >
            <option value="">{value.categoryId ? "Nessuno" : "Scegli prima una categoria"}</option>
            {filteredAssets.map((asset) => (
              <option key={asset.id} value={asset.id}>
                {asset.name}
              </option>
            ))}
          </select>
        </div>

        {showExpiry ? (
          <div className="flex flex-col gap-1">
            <label
              htmlFor={`${idPrefix}-expires`}
              className="text-xs font-medium text-zinc-600 dark:text-zinc-400"
            >
              Scadenza
            </label>
            <input
              id={`${idPrefix}-expires`}
              type="date"
              value={value.expiresAt}
              onChange={(e) => onChange({ ...value, expiresAt: e.target.value })}
              className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
            />
          </div>
        ) : null}
      </div>

      <div className="flex flex-col gap-1">
        <label
          htmlFor={`${idPrefix}-tags`}
          className="text-xs font-medium text-zinc-600 dark:text-zinc-400"
        >
          Tag (separati da virgola)
        </label>
        <input
          id={`${idPrefix}-tags`}
          type="text"
          value={value.tagsInput}
          onChange={(e) => onChange({ ...value, tagsInput: e.target.value })}
          placeholder="es. fattura, 2026, casa"
          className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label
          htmlFor={`${idPrefix}-notes`}
          className="text-xs font-medium text-zinc-600 dark:text-zinc-400"
        >
          Note
        </label>
        <textarea
          id={`${idPrefix}-notes`}
          value={value.notes}
          onChange={(e) => onChange({ ...value, notes: e.target.value })}
          rows={2}
          className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
        />
      </div>
    </div>
  );
}
