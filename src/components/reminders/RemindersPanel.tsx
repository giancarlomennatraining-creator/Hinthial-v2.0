"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/db/supabase/client";
import { deleteReminder, listReminders, setReminderCompleted } from "@/domain/reminders/repository";
import { SearchInput } from "@/components/ui/SearchInput";
import { ListSkeleton } from "@/components/ui/Skeleton";
import { ListViewToggle } from "@/components/ui/ListViewToggle";
import { Pagination } from "@/components/ui/Pagination";
import { RowActionsMenu, RowMenuItem } from "@/components/ui/RowActionsMenu";
import { SortableColumnHeader } from "@/components/ui/SortableColumnHeader";
import { useListViewPreferences } from "@/components/layout/ListViewPreferencesProvider";
import { TABLE_PAGE_SIZE } from "@/lib/list-view";
import { applySort, toggleSort, type SortState } from "@/lib/table-sort";
import { buildIcsCalendar } from "@/lib/ics";
import { saveBlobAsFile } from "@/lib/download";
import { sanitizeFilename } from "@/lib/utils";
import type { ReminderListItem } from "@/domain/reminders/types";

type StatusFilter = "all" | "pending" | "completed";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("it-IT", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

const DAY_MS = 24 * 60 * 60 * 1000;

function dueStatus(dueAt: string, completed: boolean): "overdue" | "soon" | "ok" {
  if (completed) return "ok";
  const daysLeft = (new Date(dueAt).getTime() - Date.now()) / DAY_MS;
  if (daysLeft < 0) return "overdue";
  if (daysLeft <= 7) return "soon";
  return "ok";
}

type SortColumn = "completed" | "title" | "dueAt" | "links";

function linksFor(reminder: ReminderListItem): string {
  return [reminder.relatedDocumentFilename, reminder.relatedAssetName].filter(Boolean).join(" · ");
}

function sortValueFor(reminder: ReminderListItem, column: SortColumn): string {
  switch (column) {
    case "completed":
      return reminder.completed ? "Completata" : "Da completare";
    case "title":
      return reminder.title;
    case "dueAt":
      return formatDate(reminder.dueAt);
    case "links":
      return linksFor(reminder);
  }
}

export function RemindersPanel({ masterKey }: { masterKey: CryptoKey }) {
  const supabase = useRef(createClient()).current;
  const router = useRouter();
  const searchParams = useSearchParams();

  const [reminders, setReminders] = useState<ReminderListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<SortState<SortColumn> | null>({ key: "completed", direction: "asc" });

  const { modeFor } = useListViewPreferences();
  const viewMode = modeFor("reminders");

  // "?created=1" arriva da /reminders/new dopo un salvataggio riuscito ---
  // v. CapsulesPanel.tsx per il motivo dello stato pigro qui sotto.
  const [showCreatedMessage] = useState(() => searchParams.get("created") === "1");
  useEffect(() => {
    if (showCreatedMessage) router.replace("/reminders");
  }, [showCreatedMessage, router]);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      setReminders(await listReminders(supabase, masterKey));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossibile caricare le scadenze.");
    } finally {
      setLoading(false);
    }
  }, [supabase, masterKey]);

  useEffect(() => {
    // See DocumentsPanel.tsx for why fetch-on-mount is legitimate here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
  }, [refresh]);

  async function handleToggleCompleted(reminder: ReminderListItem) {
    setBusyId(reminder.id);
    setError(null);
    try {
      await setReminderCompleted(supabase, reminder.id, !reminder.completed);
      setReminders((prev) =>
        prev.map((r) => (r.id === reminder.id ? { ...r, completed: !r.completed } : r)),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossibile aggiornare la scadenza.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(reminder: ReminderListItem) {
    if (!window.confirm(`Eliminare la scadenza "${reminder.title}"?`)) return;

    setBusyId(reminder.id);
    setError(null);
    try {
      await deleteReminder(supabase, reminder.id);
      setReminders((prev) => prev.filter((r) => r.id !== reminder.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossibile eliminare la scadenza.");
    } finally {
      setBusyId(null);
    }
  }

  function handleExportOne(reminder: ReminderListItem) {
    const ics = buildIcsCalendar([{ id: reminder.id, title: reminder.title, dueAt: reminder.dueAt }]);
    saveBlobAsFile(
      new Blob([ics], { type: "text/calendar" }),
      `${sanitizeFilename(reminder.title)}.ics`,
    );
  }

  const filteredReminders = reminders
    .filter((r) => {
      const normalized = query.trim().toLowerCase();
      if (!normalized) return true;
      const haystack = [r.title, r.relatedDocumentFilename, r.relatedAssetName]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(normalized);
    })
    .filter((r) => {
      if (statusFilter === "pending") return !r.completed;
      if (statusFilter === "completed") return r.completed;
      return true;
    });

  function handleExportAll() {
    const ics = buildIcsCalendar(
      filteredReminders.map((r) => ({ id: r.id, title: r.title, dueAt: r.dueAt })),
    );
    saveBlobAsFile(new Blob([ics], { type: "text/calendar" }), "hinthial-scadenze.ics");
  }

  function handleSort(column: SortColumn) {
    setSort((prev) => toggleSort(prev, column));
  }

  // Solo la vista a tabella si ordina --- l'elenco resta cronologico.
  const sortedReminders = applySort(filteredReminders, sort, sortValueFor);

  // Si riclampa invece di resettare con un effect: se un filtro riduce i
  // risultati, la pagina torna da sola entro il range valido.
  const pageCount = Math.max(1, Math.ceil(filteredReminders.length / TABLE_PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pagedReminders = sortedReminders.slice(
    (currentPage - 1) * TABLE_PAGE_SIZE,
    currentPage * TABLE_PAGE_SIZE,
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
            Scadenze
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Promemoria per le date importanti, cifrati come tutto il resto.
          </p>
        </div>
        <Link
          href="/reminders/new"
          className="shrink-0 rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-hover"
        >
          + Crea scadenza
        </Link>
      </div>

      {showCreatedMessage ? (
        <p className="text-sm text-lime-700 dark:text-lime-400">✅ Scadenza creata.</p>
      ) : null}

      {error ? (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : null}

      {loading ? (
        <ListSkeleton />
      ) : reminders.length === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-300 p-8 text-center dark:border-zinc-700">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Nessuna scadenza ancora. Aggiungine una col tasto qui sopra.
          </p>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-3">
            <SearchInput value={query} onChange={setQuery} placeholder="Cerca per titolo…" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              aria-label="Filtra per stato"
              className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
            >
              <option value="all">Tutte</option>
              <option value="pending">Da completare</option>
              <option value="completed">Completate</option>
            </select>
            <button
              type="button"
              onClick={handleExportAll}
              disabled={filteredReminders.length === 0}
              title="Scarica un file .ics da importare nel calendario del telefono o del computer."
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
            >
              📅 Esporta calendario (.ics)
            </button>
            <ListViewToggle section="reminders" />
          </div>

          {filteredReminders.length === 0 ? (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Nessuna scadenza corrisponde alla ricerca.
            </p>
          ) : viewMode === "table" ? (
            <div className="flex flex-col gap-3">
              <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-200 text-left text-xs font-medium text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                      <SortableColumnHeader
                        label="Fatto"
                        sortKey="completed"
                        sort={sort}
                        onSort={handleSort}
                      />
                      <SortableColumnHeader label="Titolo" sortKey="title" sort={sort} onSort={handleSort} />
                      <SortableColumnHeader
                        label="Scadenza"
                        sortKey="dueAt"
                        sort={sort}
                        onSort={handleSort}
                      />
                      <SortableColumnHeader
                        label="Collegamenti"
                        sortKey="links"
                        sort={sort}
                        onSort={handleSort}
                      />
                      <th className="p-3">Azioni</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                    {pagedReminders.map((reminder) => {
                      const status = dueStatus(reminder.dueAt, reminder.completed);
                      const busy = busyId === reminder.id;
                      return (
                        <tr key={reminder.id}>
                          <td className="p-3">
                            <input
                              type="checkbox"
                              checked={reminder.completed}
                              disabled={busy}
                              onChange={() => handleToggleCompleted(reminder)}
                              aria-label={`Segna "${reminder.title}" come completata`}
                            />
                          </td>
                          <td
                            className={
                              reminder.completed
                                ? "max-w-[16rem] truncate p-3 text-zinc-400 line-through dark:text-zinc-600"
                                : "max-w-[16rem] truncate p-3 font-medium text-zinc-900 dark:text-zinc-100"
                            }
                          >
                            {reminder.title}
                          </td>
                          <td className="p-3">
                            <span
                              className={
                                status === "overdue"
                                  ? "font-medium text-red-600 dark:text-red-400"
                                  : status === "soon"
                                    ? "font-medium text-orange-600 dark:text-orange-400"
                                    : "text-zinc-600 dark:text-zinc-400"
                              }
                            >
                              {formatDate(reminder.dueAt)}
                            </span>
                          </td>
                          <td className="max-w-[14rem] truncate p-3 text-zinc-600 dark:text-zinc-400">
                            {linksFor(reminder) || "—"}
                          </td>
                          <td className="p-3">
                            <RowActionsMenu label={`Azioni per "${reminder.title}"`}>
                              <RowMenuItem onClick={() => handleExportOne(reminder)}>
                                📅 Aggiungi al calendario (.ics)
                              </RowMenuItem>
                              <RowMenuItem disabled={busy} danger onClick={() => handleDelete(reminder)}>
                                Elimina
                              </RowMenuItem>
                            </RowActionsMenu>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <Pagination page={currentPage} pageCount={pageCount} onChange={setPage} />
            </div>
          ) : (
            <ul className="flex flex-col divide-y divide-zinc-200 rounded-lg border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
              {filteredReminders.map((reminder) => {
                const status = dueStatus(reminder.dueAt, reminder.completed);
                const busy = busyId === reminder.id;
                return (
                  <li key={reminder.id} className="flex items-center justify-between gap-4 p-4">
                    <label className="flex min-w-0 items-start gap-3">
                      <input
                        type="checkbox"
                        checked={reminder.completed}
                        disabled={busy}
                        onChange={() => handleToggleCompleted(reminder)}
                        className="mt-1"
                      />
                      <span className="min-w-0">
                        <p
                          className={
                            reminder.completed
                              ? "truncate text-sm text-zinc-400 line-through dark:text-zinc-600"
                              : "truncate text-sm font-medium text-zinc-900 dark:text-zinc-100"
                          }
                        >
                          {reminder.title}
                        </p>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">
                          <span
                            className={
                              status === "overdue"
                                ? "font-medium text-red-600 dark:text-red-400"
                                : status === "soon"
                                  ? "font-medium text-orange-600 dark:text-orange-400"
                                  : ""
                            }
                          >
                            {formatDate(reminder.dueAt)}
                          </span>
                          {reminder.relatedDocumentFilename ? ` · ${reminder.relatedDocumentFilename}` : ""}
                          {reminder.relatedAssetName ? ` · 🔗 ${reminder.relatedAssetName}` : ""}
                        </p>
                      </span>
                    </label>
                    <RowActionsMenu label={`Azioni per "${reminder.title}"`}>
                      <RowMenuItem onClick={() => handleExportOne(reminder)}>
                        📅 Aggiungi al calendario (.ics)
                      </RowMenuItem>
                      <RowMenuItem disabled={busy} danger onClick={() => handleDelete(reminder)}>
                        Elimina
                      </RowMenuItem>
                    </RowActionsMenu>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
