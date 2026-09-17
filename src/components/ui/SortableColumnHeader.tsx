"use client";

import { cn } from "@/lib/utils";
import type { SortState } from "@/lib/table-sort";

/** Intestazione di colonna cliccabile per ordinare una tabella --- v. lib/table-sort.ts. */
export function SortableColumnHeader<K extends string>({
  label,
  sortKey,
  sort,
  onSort,
  className,
}: {
  label: string;
  sortKey: K;
  sort: SortState<K> | null;
  onSort: (key: K) => void;
  /**
   * Regola di visibilità della colonna, quando è secondaria --- es.
   * "hidden @3xl:table-cell" la fa comparire solo se il contenitore
   * della tabella è abbastanza largo (v. i pannelli di lista: la
   * stessa classe va anche sulla `<td>` corrispondente).
   */
  className?: string;
}) {
  const isActive = sort?.key === sortKey;
  const ariaSort = isActive ? (sort.direction === "asc" ? "ascending" : "descending") : "none";

  return (
    <th className={cn("p-3", className)} aria-sort={ariaSort}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className="flex items-center gap-1 text-xs font-medium text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
      >
        {label}
        <span aria-hidden="true" className="text-[0.6rem]">
          {isActive ? (sort.direction === "asc" ? "▲" : "▼") : ""}
        </span>
      </button>
    </th>
  );
}
