"use client";

import { useState } from "react";
import type { DocumentSummary } from "@/domain/documents/types";
import type { Category } from "@/domain/categories/types";
import { groupByMonth, type ArchiveSort } from "@/domain/documents/archive-overview";
import { DocumentCard } from "@/components/documents/archive/DocumentCard";

const PAGE = 24;

const GRID = "grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5";

/**
 * Tutti i contenuti come schede con l'anteprima, a gruppi di ventiquattro: "Mostra altri" al posto di una pagina senza
 * fondo. Con l'ordine per data sono raggruppati per mese; con gli altri ordini una griglia sola.
 */
export function ArchiveCards({
  documents,
  categories,
  sort,
  masterKey,
  now,
}: {
  documents: DocumentSummary[];
  categories: Category[];
  sort: ArchiveSort;
  masterKey: CryptoKey;
  now: Date;
}) {
  const [limit, setLimit] = useState(PAGE);
  const shown = documents.slice(0, limit);
  const categoryById = new Map(categories.map((c) => [c.id, c]));
  const card = (doc: DocumentSummary) => (
    <li key={doc.id} className="min-w-0">
      <DocumentCard
        doc={doc}
        category={doc.categoryId ? (categoryById.get(doc.categoryId) ?? null) : null}
        masterKey={masterKey}
        now={now}
        className="h-full"
      />
    </li>
  );

  return (
    <div className="flex flex-col gap-6">
      {sort === "recenti" ? (
        groupByMonth(shown).map((group) => (
          <section key={group.key} aria-label={group.label} className="flex flex-col gap-3">
            <h2 className="text-sm font-semibold text-zinc-500 capitalize dark:text-zinc-400">{group.label}</h2>
            <ul className={GRID}>{group.documents.map(card)}</ul>
          </section>
        ))
      ) : (
        <ul className={GRID}>{shown.map(card)}</ul>
      )}

      {documents.length > limit ? (
        <button
          type="button"
          onClick={() => setLimit((l) => l + PAGE)}
          className="self-center rounded-btn border border-zinc-300 px-5 py-2 text-sm font-semibold text-accent hover:bg-brand/10 dark:border-zinc-700"
        >
          Mostra altri {Math.min(PAGE, documents.length - limit)} ({documents.length - limit} rimasti)
        </button>
      ) : null}
    </div>
  );
}
