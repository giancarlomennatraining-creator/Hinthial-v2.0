"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/db/supabase/client";
import {
  createDossier,
  deleteDossier,
  listDossierItems,
  listDossiers,
  replaceDocumentDossierLinks,
} from "@/domain/dossiers/repository";
import type { DossierStep } from "@/domain/dossiers/items";
import { DossierSuggestions } from "@/components/dossiers/DossierSuggestions";
import {
  loadDismissedSuggestions,
  newSuggestionKey,
  saveDismissedSuggestions,
  suggestNewDossiers,
  type NewDossierSuggestion,
} from "@/domain/dossiers/suggestions";
import { listDocumentSummaries } from "@/domain/documents/repository";
import { listAssets } from "@/domain/assets/repository";
import { listCategories } from "@/domain/categories/repository";
import { listReminders } from "@/domain/reminders/repository";
import { DossierCard } from "@/components/dossiers/DossierCard";
import { categoryColor, needsAttention } from "@/domain/documents/archive-views";
import { dossierOverview, type DossierOverview } from "@/domain/dossiers/overview";
import type { AssetListItem } from "@/domain/assets/types";
import type { Category } from "@/domain/categories/types";
import type { ReminderListItem } from "@/domain/reminders/types";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/format";
import { MobileAddFab } from "@/components/ui/MobileAddFab";
import { SearchInput } from "@/components/ui/SearchInput";
import { ListSkeleton } from "@/components/ui/Skeleton";
import { ListViewToggle } from "@/components/ui/ListViewToggle";
import { Pagination } from "@/components/ui/Pagination";
import { RowActionsMenu, RowMenuItem } from "@/components/ui/RowActionsMenu";
import { SortableColumnHeader } from "@/components/ui/SortableColumnHeader";
import { useListViewPreferences } from "@/components/layout/ListViewPreferencesProvider";
import { ArchiveTabs } from "@/components/documents/ArchiveTabs";
import { PageHelp } from "@/components/help/PageHelp";
import { TABLE_PAGE_SIZE } from "@/lib/list-view";
import { applySort, toggleSort, type SortState } from "@/lib/table-sort";
import { useToast } from "@/components/ui/ToastProvider";
import type { DossierListItem, DossierStatus } from "@/domain/dossiers/types";
import type { DocumentSummary } from "@/domain/documents/types";

type SortColumn = "title" | "status" | "documents" | "createdAt";

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
  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [assets, setAssets] = useState<AssetListItem[]>([]);
  const [reminders, setReminders] = useState<ReminderListItem[]>([]);
  const [steps, setSteps] = useState<DossierStep[]>([]);
  const [now] = useState(() => new Date());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [suggestionBusy, setSuggestionBusy] = useState<string | null>(null);
  // I "Non ora" si ricordano sul dispositivo: si leggono dopo il montaggio (lo storage non esiste sul server).
  const [dismissed, setDismissed] = useState<ReadonlySet<string>>(new Set());
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | DossierStatus | "soon">("");
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
      const [dossiersResult, documentsResult, categoriesResult, assetsResult, remindersResult, itemsResult] = await Promise.all([
        listDossiers(supabase, masterKey),
        listDocumentSummaries(supabase, masterKey),
        listCategories(supabase),
        listAssets(supabase, masterKey),
        // Le scadenze servono solo a dire "prossima scadenza": se non si leggono, la scheda resta com'è.
        listReminders(supabase, masterKey).catch((): ReminderListItem[] => []),
        // I prossimi passi contano tra le scadenze: se non si leggono, la scheda resta com'è.
        listDossierItems(supabase, masterKey).catch(() => ({ steps: [] as DossierStep[], people: [] })),
      ]);
      setSteps(itemsResult.steps);
      setDossiers(dossiersResult);
      setDocuments(documentsResult);
      setCategories(categoriesResult);
      setAssets(assetsResult);
      setReminders(remindersResult);
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

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDismissed(loadDismissedSuggestions());
  }, []);

  function handleDismissSuggestion(suggestion: NewDossierSuggestion) {
    const next = new Set(dismissed).add(newSuggestionKey(suggestion.assetId));
    setDismissed(next);
    saveDismissedSuggestions(next);
  }

  /** Crea il fascicolo col nome del bene e vi collega i documenti (nessuno aveva già un fascicolo, v. suggestNewDossiers). */
  async function handleAcceptSuggestion(suggestion: NewDossierSuggestion) {
    setSuggestionBusy(suggestion.assetId);
    setError(null);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Devi essere autenticato.");
      const dossierId = await createDossier(supabase, masterKey, user.id, { title: suggestion.title, description: "" });
      for (const documentId of suggestion.documentIds) {
        await replaceDocumentDossierLinks(supabase, user.id, documentId, [dossierId]);
      }
      router.push(`/dossiers/${dossierId}?created=1`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossibile creare il fascicolo.");
      setSuggestionBusy(null);
    }
  }

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

  function documentsFor(dossier: DossierListItem): DocumentSummary[] {
    return documents.filter((doc) => doc.dossierIds.includes(dossier.id));
  }

  function sortValueFor(dossier: DossierListItem, column: SortColumn): string {
    switch (column) {
      case "title":
        return dossier.title;
      case "status":
        return STATUS_LABEL[dossier.status];
      case "documents":
        return String(documentsFor(dossier).length);
      case "createdAt":
        return formatDate(dossier.createdAt);
    }
  }

  function handleSort(column: SortColumn) {
    setSort((prev) => toggleSort(prev, column));
  }

  const overviews = new Map<string, DossierOverview>(
    dossiers.map((dossier) => [dossier.id, dossierOverview({ documents: documentsFor(dossier), reminders, assets, steps: steps.filter((s) => s.dossierId === dossier.id), now })]),
  );
  const isSoon = (dossier: DossierListItem) => {
    const next = overviews.get(dossier.id)?.nextDeadline;
    return dossier.status === "open" && next !== null && next !== undefined && needsAttention(next.info);
  };

  const filteredDossiers = dossiers
    .filter((dossier) => {
      const normalized = query.trim().toLowerCase();
      return !normalized || dossier.title.toLowerCase().includes(normalized);
    })
    .filter((dossier) => !statusFilter || (statusFilter === "soon" ? isSoon(dossier) : dossier.status === statusFilter));

  const chips: { value: "" | DossierStatus | "soon"; label: string; count: number }[] = [
    { value: "", label: "Tutti", count: dossiers.length },
    { value: "open", label: "Aperti", count: dossiers.filter((d) => d.status === "open").length },
    { value: "closed", label: "Chiusi", count: dossiers.filter((d) => d.status === "closed").length },
    { value: "soon", label: "Con scadenze vicine", count: dossiers.filter(isSoon).length },
  ];

  /** Il colore del fascicolo: quello della categoria più presente nei suoi documenti, o il blu di Hinthial. */
  function colorOf(dossier: DossierListItem): string {
    const counts = new Map<string, number>();
    for (const doc of documentsFor(dossier)) {
      const name = categories.find((c) => c.id === doc.categoryId)?.name;
      if (name) counts.set(name, (counts.get(name) ?? 0) + 1);
    }
    const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
    return top ? categoryColor(top[0]) : "#2b4fc4";
  }
  function pageColorsOf(dossier: DossierListItem): string[] {
    return [...documentsFor(dossier)]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 3)
      .map((doc) => categoryColor(categories.find((c) => c.id === doc.categoryId)?.name ?? null));
  }

  const sortedDossiers = applySort(filteredDossiers, sort, sortValueFor);

  const pageCount = Math.max(1, Math.ceil(filteredDossiers.length / TABLE_PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pagedDossiers = sortedDossiers.slice(
    (currentPage - 1) * TABLE_PAGE_SIZE,
    currentPage * TABLE_PAGE_SIZE,
  );

  return (
    <div className="flex flex-col gap-6 pb-[calc(3rem+env(safe-area-inset-bottom))] sm:pb-0">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-start justify-between gap-3">
          <h1 className="text-2xl font-semibold tracking-tight text-brand">Archivio</h1>
          <PageHelp
            title="Fascicoli"
            tips={[
              { icon: "📂", text: "Un fascicolo raggruppa più contenuti di una stessa vicenda, anche di categorie diverse." },
              { icon: "➕", text: "Crea un fascicolo nuovo, poi collegaci i documenti dalla loro scheda." },
              { icon: "🗂️", text: "Segna un fascicolo come chiuso quando la vicenda è finita: resta consultabile." },
              { icon: "🔗", text: "Eliminare un fascicolo non elimina i documenti: vengono solo scollegati." },
            ]}
          />
        </div>
        <Link
          href="/dossiers/new"
          className="hidden shrink-0 rounded-xl bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-hover sm:block"
        >
          + Nuovo fascicolo
        </Link>
      </div>

      <ArchiveTabs />

      <MobileAddFab href="/dossiers/new" label="Nuovo fascicolo" />

      {error ? (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : null}

      {!loading ? (
        <DossierSuggestions
          suggestions={suggestNewDossiers({ documents, dossiers, assets, dismissed })}
          busyKey={suggestionBusy}
          onAccept={handleAcceptSuggestion}
          onDismiss={handleDismissSuggestion}
        />
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
          <div className="flex flex-wrap items-center gap-3">
            <SearchInput value={query} onChange={setQuery} placeholder="Cerca per titolo…" />
            <ListViewToggle section="dossiers" hideOnMobile />
          </div>

          <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filtra per stato">
            {chips.map((chip) => {
              const active = statusFilter === chip.value;
              return (
                <button
                  key={chip.value || "all"}
                  type="button"
                  aria-pressed={active}
                  onClick={() => {
                    setStatusFilter(chip.value);
                    setPage(1);
                  }}
                  className={cn(
                    "flex items-center gap-2 rounded-full border px-3.5 py-[7px] text-[13.5px] font-semibold transition-colors",
                    active
                      ? "border-brand bg-brand text-white"
                      : "border-[#dfe3f0] bg-white text-[#121a35] hover:bg-[#e8edfc] dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:hover:bg-zinc-900",
                  )}
                >
                  <span>{chip.label}</span>
                  <span className={cn("text-xs font-bold", active ? "text-[#cfdaff]" : "text-[#5b6483] dark:text-zinc-400")}>{chip.count}</span>
                </button>
              );
            })}
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
            <div className="grid grid-cols-1 items-start gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {filteredDossiers.map((dossier) => (
                <DossierCard
                  key={dossier.id}
                  dossier={dossier}
                  overview={overviews.get(dossier.id) as DossierOverview}
                  color={colorOf(dossier)}
                  pageColors={pageColorsOf(dossier)}
                  now={now}
                  busy={busyId === dossier.id}
                  onOpen={() => router.push(`/dossiers/${dossier.id}`)}
                  onEdit={() => router.push(`/dossiers/${dossier.id}/edit`)}
                  onDelete={() => handleDelete(dossier)}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
