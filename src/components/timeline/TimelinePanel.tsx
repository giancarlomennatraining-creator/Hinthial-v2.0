"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/db/supabase/client";
import { buildAIContext } from "@/domain/ai/context";
import { buildTimeline, groupTimelineByMonth, type TimelineEntryKind } from "@/lib/timeline";
import { ListSkeleton } from "@/components/ui/Skeleton";
import { ListViewToggle } from "@/components/ui/ListViewToggle";
import { Pagination } from "@/components/ui/Pagination";
import { SortableColumnHeader } from "@/components/ui/SortableColumnHeader";
import { useListViewPreferences } from "@/components/layout/ListViewPreferencesProvider";
import { TABLE_PAGE_SIZE } from "@/lib/list-view";
import { applySort, toggleSort, type SortState } from "@/lib/table-sort";
import type { AIContext } from "@/domain/ai/types";
import type { TimelineEntry } from "@/lib/timeline";

const KIND_LABEL: Record<TimelineEntryKind, string> = {
  document: "Archivio",
  asset: "Asset",
  reminder: "Scadenza",
  contact: "Contatto",
  capsule: "Capsula",
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("it-IT", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

type SortColumn = "label" | "kind" | "date";

function sortValueFor(entry: TimelineEntry, column: SortColumn): string {
  switch (column) {
    case "label":
      return entry.label;
    case "kind":
      return KIND_LABEL[entry.kind];
    case "date":
      return formatDate(entry.date);
  }
}

/**
 * "Cronologia": ogni documento, asset, scadenza, contatto fiduciario e
 * capsula aggiunto, in ordine cronologico e raggruppato per mese --- uno
 * sguardo d'insieme su come è cresciuto il vault nel tempo (v. lib/timeline.ts).
 */
export function TimelinePanel({ masterKey }: { masterKey: CryptoKey }) {
  const supabase = useRef(createClient()).current;

  const [context, setContext] = useState<AIContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<SortState<SortColumn> | null>({ key: "label", direction: "asc" });

  const { modeFor } = useListViewPreferences();
  const viewMode = modeFor("timeline");

  const refresh = useCallback(async () => {
    setError(null);
    try {
      setContext(await buildAIContext(supabase, masterKey));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossibile caricare la cronologia.");
    } finally {
      setLoading(false);
    }
  }, [supabase, masterKey]);

  useEffect(() => {
    // See DocumentsPanel.tsx for why fetch-on-mount is legitimate here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
  }, [refresh]);

  function handleSort(column: SortColumn) {
    setSort((prev) => toggleSort(prev, column));
  }

  const entries = context ? buildTimeline(context) : [];
  const groups = groupTimelineByMonth(entries);

  // Solo la vista a tabella si ordina --- i gruppi per mese restano cronologici.
  const sortedEntries = applySort(entries, sort, sortValueFor);

  // Si riclampa invece di resettare con un effect: se il numero di
  // elementi cambia (es. dopo un refresh), la pagina torna da sola entro
  // il range valido.
  const pageCount = Math.max(1, Math.ceil(entries.length / TABLE_PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pagedEntries = sortedEntries.slice(
    (currentPage - 1) * TABLE_PAGE_SIZE,
    currentPage * TABLE_PAGE_SIZE,
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
            Cronologia
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Uno sguardo d&apos;insieme su come è cresciuta la tua vita digitale nel tempo.
          </p>
        </div>
        {groups.length > 0 ? <ListViewToggle section="timeline" /> : null}
      </div>

      {error ? (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : null}

      {loading ? (
        <ListSkeleton />
      ) : groups.length === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-300 p-8 text-center dark:border-zinc-700">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Non c&apos;è ancora nulla da mostrare qui. Inizia da{" "}
            <Link href="/archive" className="font-medium text-brand hover:underline">
              Documenti
            </Link>{" "}
            per aggiungere il tuo primo elemento.
          </p>
        </div>
      ) : viewMode === "table" ? (
        <div className="flex flex-col gap-3">
          <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-left text-xs font-medium text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                  <SortableColumnHeader label="Elemento" sortKey="label" sort={sort} onSort={handleSort} />
                  <SortableColumnHeader label="Sezione" sortKey="kind" sort={sort} onSort={handleSort} />
                  <SortableColumnHeader label="Data" sortKey="date" sort={sort} onSort={handleSort} />
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {pagedEntries.map((entry) => (
                  <tr key={`${entry.kind}:${entry.id}`}>
                    <td className="max-w-[20rem] p-3">
                      <Link
                        href={entry.href}
                        className="flex min-w-0 items-center gap-2 text-zinc-800 hover:underline dark:text-zinc-200"
                      >
                        <span aria-hidden="true">{entry.icon}</span>
                        <span className="truncate">{entry.label}</span>
                      </Link>
                    </td>
                    <td className="p-3 text-zinc-600 dark:text-zinc-400">{KIND_LABEL[entry.kind]}</td>
                    <td className="p-3 text-zinc-600 dark:text-zinc-400">{formatDate(entry.date)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={currentPage} pageCount={pageCount} onChange={setPage} />
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {groups.map((group) => (
            <div key={group.label}>
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                {group.label}
              </h2>
              <ul className="mt-2 flex flex-col divide-y divide-zinc-200 rounded-lg border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
                {group.entries.map((entry) => (
                  <li
                    key={`${entry.kind}:${entry.id}`}
                    className="flex items-center justify-between gap-4 p-3"
                  >
                    <Link
                      href={entry.href}
                      className="flex min-w-0 items-center gap-2 text-sm text-zinc-800 hover:underline dark:text-zinc-200"
                    >
                      <span aria-hidden="true">{entry.icon}</span>
                      <span className="truncate">{entry.label}</span>
                    </Link>
                    <span className="shrink-0 text-xs text-zinc-500 dark:text-zinc-400">
                      {formatDate(entry.date)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
