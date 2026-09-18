"use client";

import { sortAlphabetically } from "@/lib/utils";
import type { Category } from "@/domain/categories/types";
import type { AssetListItem } from "@/domain/assets/types";
import type { DocumentListItem } from "@/domain/documents/types";

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

/** Converte un DocumentListItem già decifrato nei valori di partenza del form --- usato sia dall'edit inline (DocumentsPanel) sia dalla pagina di modifica dedicata (EditArchiveItemForm). */
export function documentToFields(doc: DocumentListItem): DocumentMetadataFieldsValue {
  return {
    categoryId: doc.categoryId ?? "",
    relatedAssetId: doc.relatedAssetId ?? "",
    expiresAt: doc.expiresAt ? doc.expiresAt.slice(0, 10) : "",
    notes: doc.notes,
    tagsInput: doc.tags.join(", "),
  };
}

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
  hints,
}: {
  idPrefix: string;
  categories: Category[];
  assets: AssetListItem[];
  value: DocumentMetadataFieldsValue;
  onChange: (next: DocumentMetadataFieldsValue) => void;
  /**
   * Il campo scadenza era nascosto in creazione perché "raramente si
   * conosce già la scadenza esatta --- la si aggiunge dopo, a mano o in
   * futuro suggerita dall'AI che legge il contenuto". Quel futuro è
   * arrivato (FASE 19b): il documento viene letto appena lo scegli, e
   * se una scadenza c'è dentro la trova. Resta il parametro perché
   * altrove (audio, video, note) chiederla non ha ancora senso.
   */
  showExpiry?: boolean;
  /**
   * FASE 19b --- una riga sotto a un campo, per dire chi ce l'ha messo e
   * da dove viene ("suggerita da Hinthial", oppure la frase del
   * documento in cui compare quella data). Sta qui e non nel chiamante
   * perché è questo componente a possedere il layout dei campi.
   */
  hints?: Partial<Record<"categoryId" | "relatedAssetId" | "expiresAt", React.ReactNode>>;
}) {
  // La categoria filtra i beni proposti (es. "Casa" -> solo i beni
  // di categoria "Casa") --- senza categoria selezionata, nessun bene è
  // proponibile: la scelta della categoria viene prima.
  const filteredAssets = value.categoryId
    ? sortAlphabetically(
        assets.filter((asset) => asset.categoryId === value.categoryId),
        (asset) => asset.name,
      )
    : [];

  function handleCategoryChange(categoryId: string) {
    // Se il bene già selezionato non appartiene alla nuova categoria,
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
          {hints?.categoryId}
        </div>

        <div className="flex flex-col gap-1">
          <label
            htmlFor={`${idPrefix}-asset`}
            className="text-xs font-medium text-zinc-600 dark:text-zinc-400"
          >
            Bene collegato
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
          {hints?.relatedAssetId}
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
            {hints?.expiresAt}
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
          className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
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
          className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
        />
      </div>
    </div>
  );
}
