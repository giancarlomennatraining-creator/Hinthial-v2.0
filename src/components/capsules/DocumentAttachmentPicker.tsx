"use client";

import { useState } from "react";
import { sortAlphabetically } from "@/lib/utils";
import { contentKindFor, CONTENT_KIND_ICON } from "@/lib/content-kind";
import type { Category } from "@/domain/categories/types";
import type { DocumentListItem } from "@/domain/documents/types";

/**
 * Lets the user attach one or more already-existing Archivio entries to
 * a capsule --- filter by category, then pick an item, "+ Allega" to
 * add it to the running list. No copy/re-encryption happens: this just
 * accumulates the ids the caller will pass along (see
 * CapsuleInput.linkedDocumentIds / CapsuleEditInput.linkedDocumentIds).
 * Works for any content kind (documento/immagine/audio/video/nota) ---
 * they're all rows of the same table (v. lib/content-kind.ts).
 */
export function DocumentAttachmentPicker({
  idPrefix,
  categories,
  documents,
  selected,
  onChange,
}: {
  idPrefix: string;
  categories: Category[];
  documents: DocumentListItem[];
  selected: DocumentListItem[];
  onChange: (next: DocumentListItem[]) => void;
}) {
  const [categoryId, setCategoryId] = useState("");
  const [documentId, setDocumentId] = useState("");

  const selectedIds = new Set(selected.map((d) => d.id));
  const pickableDocuments = categoryId
    ? sortAlphabetically(
        documents.filter((d) => d.categoryId === categoryId && !selectedIds.has(d.id)),
        (d) => d.filename,
      )
    : [];

  function handleCategoryChange(next: string) {
    setCategoryId(next);
    // La categoria cambia l'elenco proponibile: il documento scelto prima potrebbe non esserci più.
    setDocumentId("");
  }

  function handleAdd() {
    const doc = documents.find((d) => d.id === documentId);
    if (!doc) return;
    onChange([...selected, doc]);
    setDocumentId("");
  }

  function handleRemove(id: string) {
    onChange(selected.filter((d) => d.id !== id));
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
        Allega un contenuto già presente in Archivio
      </p>
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex flex-col gap-1">
          <label
            htmlFor={`${idPrefix}-category`}
            className="text-xs text-zinc-500 dark:text-zinc-500"
          >
            Categoria
          </label>
          <select
            id={`${idPrefix}-category`}
            value={categoryId}
            onChange={(e) => handleCategoryChange(e.target.value)}
            className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
          >
            <option value="">Scegli una categoria</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.icon} {category.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label
            htmlFor={`${idPrefix}-document`}
            className="text-xs text-zinc-500 dark:text-zinc-500"
          >
            Elemento d&apos;archivio
          </label>
          <select
            id={`${idPrefix}-document`}
            value={documentId}
            onChange={(e) => setDocumentId(e.target.value)}
            disabled={!categoryId}
            className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
          >
            <option value="">
              {categoryId ? "Scegli un elemento" : "Scegli prima una categoria"}
            </option>
            {pickableDocuments.map((doc) => (
              <option key={doc.id} value={doc.id}>
                {CONTENT_KIND_ICON[contentKindFor(doc.mimeType)]} {doc.filename}
              </option>
            ))}
          </select>
        </div>

        <button
          type="button"
          disabled={!documentId}
          onClick={handleAdd}
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
        >
          + Allega
        </button>
      </div>

      {selected.length > 0 ? (
        <ul className="flex flex-wrap gap-1">
          {selected.map((doc) => (
            <li
              key={doc.id}
              className="flex items-center gap-1 rounded-full bg-zinc-100 py-0.5 pl-2.5 pr-1 text-xs text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
            >
              <span>
                {CONTENT_KIND_ICON[contentKindFor(doc.mimeType)]} {doc.filename}
              </span>
              <button
                type="button"
                onClick={() => handleRemove(doc.id)}
                aria-label={`Rimuovi ${doc.filename}`}
                className="rounded-full px-1.5 text-zinc-500 hover:bg-zinc-200 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
