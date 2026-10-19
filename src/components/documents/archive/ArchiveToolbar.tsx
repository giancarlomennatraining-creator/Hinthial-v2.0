"use client";

import type { Category } from "@/domain/categories/types";
import { NO_CATEGORY, type ArchiveSort } from "@/domain/documents/archive-overview";
import { sortAlphabetically } from "@/lib/utils";
import { INPUT_FIELD } from "@/components/ui/styles";

/** Ricerca, categoria e ordinamento: gli stessi in Schede ed Elenco, così passando dall'una all'altra non si perde il filtro. */
export function ArchiveToolbar({
  query,
  onQuery,
  categoryFilter,
  onCategory,
  categories,
  sort,
  onSort,
}: {
  query: string;
  onQuery: (value: string) => void;
  categoryFilter: string;
  onCategory: (value: string) => void;
  categories: Category[];
  sort: ArchiveSort;
  onSort: (value: ArchiveSort) => void;
}) {
  return (
    <div className="flex flex-wrap gap-3">
      <input
        type="search"
        value={query}
        onChange={(e) => onQuery(e.target.value)}
        placeholder="Cerca per titolo, emittente, note…"
        aria-label="Cerca nell'archivio"
        className={`${INPUT_FIELD} min-w-0 flex-1 basis-56`}
      />
      <select
        value={categoryFilter}
        onChange={(e) => onCategory(e.target.value)}
        aria-label="Filtra per categoria"
        className={INPUT_FIELD}
      >
        <option value="">Tutte le categorie</option>
        {sortAlphabetically(categories, (c) => c.name).map((category) => (
          <option key={category.id} value={category.id}>
            {category.icon} {category.name}
          </option>
        ))}
        <option value={NO_CATEGORY}>🗂️ Senza categoria</option>
      </select>
      <select
        value={sort}
        onChange={(e) => onSort(e.target.value as ArchiveSort)}
        aria-label="Ordina per"
        className={INPUT_FIELD}
      >
        <option value="recenti">Più recenti</option>
        <option value="scadenza">Scadenza</option>
        <option value="nome">Nome</option>
      </select>
    </div>
  );
}
