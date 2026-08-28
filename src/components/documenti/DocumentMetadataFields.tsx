"use client";

import type { Category } from "@/domain/documents/types";

export interface DocumentMetadataFieldsValue {
  categoryId: string;
  /** yyyy-mm-dd, or "" for no expiry. */
  expiresAt: string;
  notes: string;
  /** comma-separated, parsed via parseTagsInput. */
  tagsInput: string;
}

export const EMPTY_METADATA_FIELDS: DocumentMetadataFieldsValue = {
  categoryId: "",
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
  value,
  onChange,
}: {
  idPrefix: string;
  categories: Category[];
  value: DocumentMetadataFieldsValue;
  onChange: (next: DocumentMetadataFieldsValue) => void;
}) {
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
            onChange={(e) => onChange({ ...value, categoryId: e.target.value })}
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
