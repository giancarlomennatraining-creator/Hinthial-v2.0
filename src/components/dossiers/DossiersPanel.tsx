"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/db/supabase/client";
import { deleteDossier, listDossiers } from "@/domain/dossiers/repository";
import { dossierTotalAmount } from "@/domain/dossiers/timeline";
import { listDocuments } from "@/domain/documents/repository";
import { formatAmount, formatDate } from "@/lib/format";
import { MobileAddFab } from "@/components/ui/MobileAddFab";
import { SearchInput } from "@/components/ui/SearchInput";
import { ListSkeleton } from "@/components/ui/Skeleton";
import { ListViewToggle } from "@/components/ui/ListViewToggle";
import { Pagination } from "@/components/ui/Pagination";
import { RowActionsMenu, RowMenuItem } from "@/components/ui/RowActionsMenu";
import { SortableColumnHeader } from "@/components/ui/SortableColumnHeader";
import { useListViewPreferences } from "@/components/layout/ListViewPreferencesProvider";
import { TABLE_PAGE_SIZE } from "@/lib/list-view";
import { applySort, toggleSort, type SortState } from "@/lib/table-sort";
import { useToast } from "@/components/ui/ToastProvider";
import type { DossierListItem, DossierStatus } from "@/domain/dossiers/types";
import type { DocumentListItem } from "@/domain/documents/types";

type SortColumn = "title" | "status" | "documents" | "total" | "createdAt";

const STATUS_LABEL: Record<DossierStatus, string> = { open: "Aperto", closed: "Chiuso" };
const STATUS_ICON: Record<DossierStatus, string> = { open: "📂", closed: "🗂️" };

/**
 * FASE 20 --- l'elenco dei fascicoli. I documenti si collegano dal loro
 * stesso form (v. DocumentMetadataFields, campo "Fascicolo"): qui si
 * gestiscono solo gli oggetti --- crea, rinomina, apri/chiudi, elimina.
 */
export function DossiersPanel({ masterKey }: { masterKey: CryptoKey }) {
  const supabase = useRef(createClient()).current;
  const router = useRouter();
  const searchParams = useSearchParams();
  const showToast = useToast();

  const [dossiers, setDossiers] = useState<DossierListItem[]>([]);
  const [documents, setDocuments] = useState<DocumentListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | DossierStatus>("");
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<SortState<SortColumn> | null>({ key: "createdAt", direction: "desc" });

  const { modeFor } = useListViewPreferences();
  const viewMode = modeFor("dossiers");

  const [showCreatedMessage] = useState(() => searchParams.get("created") === "1");
  const [showDeletedMessage] = useState(() => searchParams.get("deleted") === "1");
  useEffect(() => {
    if (showCreatedMessage) showToast("Fascicolo creato.");
    if (showDeletedMessage) showToast("Fascicolo eliminato.");
    if (showCreatedMessage || showDeletedMessage) router.replace("/dossiers");
  }, [showCreatedMessage, showDeletedMessage, router, showToast]);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const [dossiersResult, documentsResult] = await Promise.all([
        listDossiers(supabase, masterKey),
        listDocuments(supabase, masterKey),
      ]);
      setDossiers(dossiersResult);
      setDocuments(documentsResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossibile caricare i fascicoli.");
    } finally {
      setLoading(false);
    }
  }, [supabase, masterKey]);

  useEffect(() => {
    // See DocumentsPanel.tsx for why fetch-on-mount is legitimate here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
  }, [refresh]);

  async function handleDelete(dossier: DossierListItem) {
    if (
      !window.confirm(
        `Eliminare il fascicolo "${dossier.title}"? I documenti collegati non verranno eliminati, solo scollegati.`,
      )
    )
      return;

    setBusyId(dossier.id);
    setError(null);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Devi essere autenticato.");

      await deleteDossier(supabase, user.id, dossier.id);
      setDossiers((prev) => prev.filter((d) => d.id !== dossier.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossibile eliminare il fascicolo.");
    } finally {
      setBusyId(null);
    }
  }

  function documentsFor(dossier: DossierListItem): DocumentListItem[] {
    return documents.filter((doc) => doc.dossierId === dossier.id);
  }

  function sortValueFor(dossier: DossierListItem, column: SortColumn): string {
    switch (column) {
      case "title":
        return dossier.title;
      case "status":
        return STATUS_LABEL[dossier.status];
      case "documents":
        return String(documentsFor(dossier).length);
      case "total":
        return dossierTotalAmount(documentsFor(dossier)) ?? "";
      case "createdAt":
        return formatDate(dossier.createdAt);
    }
  }

  function handleSort(column: SortColumn) {
    setSort((prev) => toggleSort(prev, column));
  }

  const filteredDossiers = dossiers
    .filter((dossier) => {
      const normalized = query.trim().toLowerCase();
      return !normalized || dossier.title.toLowerCase().includes(normalized);
    })
    .filter((dossier) => !statusFilter || dossier.status === statusFilter);

  const sortedDossiers = applySort(filteredDossiers, sort, sortValueFor);

  const pageCount = Math.max(1, Math.ceil(filteredDossiers.length / TABLE_PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pagedDossiers = sortedDossiers.slice(
    (currentPage - 1) * TABLE_PAGE_SIZE,
    currentPage * TABLE_PAGE_SIZE,
  );

  return (
    <div className="flex flex-col gap-6 pb-[calc(3rem+env(safe-area-inset-bottom))] sm:pb-0">
      <div className="flex flex-col items-start gap-4 sm:flex-row sm:justify-between">
        <div className="min-w-0 w-full sm:flex-1">
          <h1 className="text-2xl font-semibold tracking-tight text-brand">Fascicoli</h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Vicende che attraversano più categorie --- un problema di salute, l&apos;acquisto di una
            casa, un incidente. Collega i documenti dal loro form, con &laquo;Fascicolo&raquo;.
          </p>
        </div>
        <Link
          href="/dossiers/new"
          className="hidden shrink-0 rounded-xl bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-hover sm:block"
        >
          + Nuovo fascicolo
        </Link>
      </div>

      <MobileAddFab href="/dossiers/new" label="Nuovo fascicolo" />

      {error ? (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : null}

      {loading ? (
        <ListSkeleton />
      ) : dossiers.length === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-300 p-8 text-center dark:border-zinc-700">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Ancora nessun fascicolo. Creane uno col tasto qui sopra.
          </p>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-3">
            <SearchInput value={query} onChange={setQuery} placeholder="Cerca per titolo…" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as "" | DossierStatus)}
              aria-label="Filtra per stato"
              className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
            >
              <option value="">Tutti gli stati</option>
              <option value="open">Aperti</option>
              <option value="closed">Chiusi</option>
            </select>
            <ListViewToggle section="dossiers" hideOnMobile />
          </div>

          {filteredDossiers.length === 0 ? (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Nessun fascicolo corrisponde alla ricerca.
            </p>
          ) : viewMode === "table" ? (
            <div className="flex flex-col gap-3">
              <div className="@container overflow-x-auto rounded-2xl border border-zinc-200 bg-white shadow-[0_8px_20px_rgba(16,24,40,0.04)] dark:border-zinc-800 dark:bg-zinc-950">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-200 text-left text-xs font-medium text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                      <SortableColumnHeader label="Titolo" sortKey="title" sort={sort} onSort={handleSort} />
                      <SortableColumnHeader
                        label="Stato"
                        sortKey="status"
                        sort={sort}
                        onSort={handleSort}
                        className="hidden @lg:table-cell"
                      />
                      <SortableColumnHeader
                        label="Documenti"
                        sortKey="documents"
                        sort={sort}
                        onSort={handleSort}
                        className="hidden @2xl:table-cell"
                      />
                      <SortableColumnHeader
                        label="Totale"
                        sortKey="total"
                        sort={sort}
                        onSort={handleSort}
                        className="hidden @3xl:table-cell"
                      />
                      <SortableColumnHeader
                        label="Creato il"
                        sortKey="createdAt"
                        sort={sort}
                        onSort={handleSort}
                        className="hidden @4xl:table-cell"
                      />
                      <th className="p-3">Azioni</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                    {pagedDossiers.map((dossier) => {
                      const busy = busyId === dossier.id;
                      const linked = documentsFor(dossier);
                      const total = dossierTotalAmount(linked);

                      return (
                        <tr key={dossier.id}>
                          <td className="max-w-[16rem] p-3 font-medium text-zinc-900 dark:text-zinc-100">
                            <Link
                              href={`/dossiers/${dossier.id}`}
                              className="block truncate transition-colors hover:text-brand dark:hover:text-blue-400"
                            >
                              {STATUS_ICON[dossier.status]} {dossier.title}
                            </Link>
                          </td>
                          <td className="hidden p-3 text-zinc-600 @lg:table-cell dark:text-zinc-400">
                            {STATUS_LABEL[dossier.status]}
                          </td>
                          <td className="hidden p-3 text-zinc-600 @2xl:table-cell dark:text-zinc-400">
                            {linked.length}
                          </td>
                          <td className="hidden p-3 text-zinc-600 @3xl:table-cell dark:text-zinc-400">
                            {total ? formatAmount(total) : "—"}
                          </td>
                          <td className="hidden p-3 text-zinc-600 @4xl:table-cell dark:text-zinc-400">
                            {formatDate(dossier.createdAt)}
                          </td>
                          <td className="p-3">
                            <RowActionsMenu label={`Azioni per ${dossier.title}`}>
                              <RowMenuItem disabled={busy} onClick={() => router.push(`/dossiers/${dossier.id}`)}>
                                Apri
                              </RowMenuItem>
                              <RowMenuItem disabled={busy} onClick={() => router.push(`/dossiers/${dossier.id}/edit`)}>
                                Modifica
                              </RowMenuItem>
                              <RowMenuItem disabled={busy} danger onClick={() => handleDelete(dossier)}>
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
            <ul className="flex flex-col divide-y divide-zinc-200 rounded-2xl border border-zinc-200 bg-white shadow-[0_8px_20px_rgba(16,24,40,0.04)] dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-950">
              {filteredDossiers.map((dossier) => {
                const busy = busyId === dossier.id;
                const linked = documentsFor(dossier);
                const total = dossierTotalAmount(linked);

                return (
                  <li key={dossier.id} className="flex flex-col gap-3 p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div className="min-w-0">
                        <Link
                          href={`/dossiers/${dossier.id}`}
                          className="block truncate text-sm font-medium text-zinc-900 transition-colors hover:text-brand dark:text-zinc-100 dark:hover:text-blue-400"
                        >
                          {STATUS_ICON[dossier.status]} {dossier.title}
                        </Link>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">
                          {STATUS_LABEL[dossier.status]} · {linked.length}{" "}
                          {linked.length === 1 ? "documento" : "documenti"}
                          {total ? ` · ${formatAmount(total)}` : ""} · {formatDate(dossier.createdAt)}
                        </p>
                      </div>
                      <RowActionsMenu label={`Azioni per ${dossier.title}`}>
                        <RowMenuItem disabled={busy} onClick={() => router.push(`/dossiers/${dossier.id}`)}>
                          Apri
                        </RowMenuItem>
                        <RowMenuItem disabled={busy} onClick={() => router.push(`/dossiers/${dossier.id}/edit`)}>
                          Modifica
                        </RowMenuItem>
                        <RowMenuItem disabled={busy} danger onClick={() => handleDelete(dossier)}>
                          Elimina
                        </RowMenuItem>
                      </RowActionsMenu>
                    </div>
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
