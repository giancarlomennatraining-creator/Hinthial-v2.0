"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/db/supabase/client";
import {
  closeCapsule,
  deleteCapsule,
  downloadCapsuleAttachment,
  listCapsules,
  listCapsulesSharedWithMe,
  shareCapsule,
  updateCapsuleAttachmentTranscript,
} from "@/domain/capsules/repository";
import { downloadDocument } from "@/domain/documents/repository";
import { getCapsuleCountdownVisible } from "@/domain/profile/repository";
import { sortAlphabetically } from "@/lib/utils";
import { saveBytesAsFile } from "@/lib/download";
import { contentKindFor, CONTENT_KIND_ICON, isTranscribable } from "@/lib/content-kind";
import { stubTranscriptionProvider } from "@/domain/transcription/stub-provider";
import { CapsuleCountdown } from "@/components/capsules/CapsuleCountdown";
import { CapsulePreview } from "@/components/capsules/CapsulePreview";
import { SharedCapsuleViewer } from "@/components/capsules/SharedCapsuleViewer";
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
import { CAPSULE_STATUS_LABEL } from "@/domain/capsules/labels";
import type {
  CapsuleAttachment,
  CapsuleListItem,
  CapsuleStatus,
  SharedCapsuleListItem,
} from "@/domain/capsules/types";
import type { DocumentListItem } from "@/domain/documents/types";
import { SuccessMessage } from "@/components/ui/SuccessMessage";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("it-IT", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** Come formatDate, ma con l'orario --- solo per l'apertura di una capsula, l'unica data dell'app che ora ne porta uno significativo. */
function formatDateTime(iso: string): string {
  const date = new Date(iso);
  const time = date.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
  return `${formatDate(iso)}, ${time}`;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}


const STATUS_LABEL = CAPSULE_STATUS_LABEL;

const STATUS_BADGE_CLASS: Record<CapsuleStatus, string> = {
  draft: "bg-zinc-100 text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400",
  ready: "bg-lime-100 text-lime-700 dark:bg-lime-950 dark:text-lime-400",
  shared: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400",
};

type SortColumn = "title" | "status" | "recipients" | "openAt" | "contents";

/**
 * FASE 8 --- Capsule digitali v1: titolo, contenuto, allegati, data di
 * apertura obbligatoria (in chiaro, unica eccezione allo zero-knowledge
 * in questa tabella --- v. domain/capsules/repository.ts, Dead Man's
 * Switch semplificato per le capsule) e uno o più destinatari; stato
 * manuale bozza -> chiusa -> condivisa. Chiudere è l'unico passaggio
 * irreversibile: da FASE 14, chiudere copia ogni contenuto d'Archivio
 * ancora collegato dentro la capsula stessa (v. domain/capsules/
 * repository.ts, closeCapsule) --- da quel momento la capsula non
 * dipende più dagli originali, che restano liberi di essere modificati
 * o cancellati. Nessun Dead Man's Switch --- chiudere rende la capsula
 * autosufficiente ma non concede ancora alcun accesso ai destinatari
 * (v. HINTHIAL_MVP.md).
 */
export function CapsulesPanel({ masterKey }: { masterKey: CryptoKey }) {
  const supabase = useRef(createClient()).current;
  const router = useRouter();
  const searchParams = useSearchParams();

  const [capsules, setCapsules] = useState<CapsuleListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [busyAttachment, setBusyAttachment] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<CapsuleStatus | "all">("all");
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<SortState<SortColumn> | null>({ key: "title", direction: "asc" });
  const [previewCapsule, setPreviewCapsule] = useState<CapsuleListItem | null>(null);
  const [openingShared, setOpeningShared] = useState<SharedCapsuleListItem | null>(null);

  // FASE B del piano di condivisione capsule --- "Condivise con me" è
  // una scheda a sé qui dentro, non una voce di menu a parte: stesso
  // tipo di contenuto, solo guardato dal verso opposto (v. richiesta
  // utente). Caricata insieme alle proprie capsule, non solo al primo
  // click sulla scheda, così passare da una vista all'altra è istantaneo.
  const [activeTab, setActiveTab] = useState<"mine" | "shared">("mine");
  const [sharedCapsules, setSharedCapsules] = useState<SharedCapsuleListItem[]>([]);
  const [sharedError, setSharedError] = useState<string | null>(null);

  // Impostazioni > Aspetto --- v. CapsuleCountdownSettings. Default true
  // mentre si attende la risposta: qui un lampo non è percepibile come
  // lo sarebbe per la disposizione del menu (v. getCapsuleCountdownVisible).
  const [showCountdown, setShowCountdown] = useState(true);

  // Trascrizione di un allegato audio/video (v. domain/transcription) --- uno alla volta.
  const [transcribingAttachmentId, setTranscribingAttachmentId] = useState<string | null>(null);
  const [transcriptDraft, setTranscriptDraft] = useState("");
  const [transcriptAutoMessage, setTranscriptAutoMessage] = useState<string | null>(null);
  const [transcriptAutoBusy, setTranscriptAutoBusy] = useState(false);
  const [transcriptSaving, setTranscriptSaving] = useState(false);

  const { modeFor } = useListViewPreferences();
  const viewMode = modeFor("capsules");

  // "?created=1"/"?updated=1" arrivano dalla pagina di creazione dedicata
  // (/capsules/new) e da quella di modifica (/capsules/[id]/edit) dopo un
  // salvataggio riuscito --- solo un flag, mai il titolo o altro contenuto
  // della capsula (finirebbe in chiaro nell'URL/cronologia). Letti una
  // sola volta all'avvio (stato pigro): il messaggio non deve sparire
  // quando subito dopo ripuliamo l'URL con router.replace.
  const [showCreatedMessage] = useState(() => searchParams.get("created") === "1");
  const [showUpdatedMessage] = useState(() => searchParams.get("updated") === "1");
  useEffect(() => {
    if (showCreatedMessage || showUpdatedMessage) router.replace("/capsules");
  }, [showCreatedMessage, showUpdatedMessage, router]);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const capsulesResult = await listCapsules(supabase, masterKey);
      setCapsules(capsulesResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossibile caricare le capsule.");
    } finally {
      setLoading(false);
    }

    // Best-effort e separato dal resto: nessuna decrittazione qui (solo
    // metadati già in chiaro), quindi un fallimento non deve impedire di
    // vedere le proprie capsule --- v. listCapsulesSharedWithMe.
    setSharedError(null);
    try {
      setSharedCapsules(await listCapsulesSharedWithMe(supabase));
    } catch (err) {
      setSharedError(err instanceof Error ? err.message : "Impossibile caricare le capsule condivise con te.");
    }

    // Anche questa best-effort: se fallisce si resta sul default (true),
    // non deve impedire di vedere le proprie capsule.
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) setShowCountdown(await getCapsuleCountdownVisible(supabase, user.id));
    } catch {
      // Resta il default.
    }
  }, [supabase, masterKey]);

  useEffect(() => {
    // See DocumentsPanel.tsx for why fetch-on-mount is legitimate here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
  }, [refresh]);

  async function handleClose(capsule: CapsuleListItem) {
    const copyNote =
      capsule.linkedDocuments.length > 0
        ? ` ${capsule.linkedDocuments.length === 1 ? "Il contenuto collegato verrà copiato" : "I contenuti collegati verranno copiati"} al suo interno --- l'originale in Archivio resterà libero di essere modificato o cancellato.`
        : "";
    if (!window.confirm(`Chiudere la capsula "${capsule.title}"? Non sarà più modificabile.${copyNote}`)) {
      return;
    }

    setBusyId(capsule.id);
    setError(null);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Devi essere autenticato.");

      await closeCapsule(supabase, masterKey, user.id, capsule);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossibile chiudere la capsula.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleShare(capsule: CapsuleListItem) {
    setBusyId(capsule.id);
    setError(null);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Devi essere autenticato.");

      await shareCapsule(supabase, masterKey, user.id, capsule);
      setCapsules((prev) => prev.map((c) => (c.id === capsule.id ? { ...c, status: "shared" } : c)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossibile condividere la capsula.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(capsule: CapsuleListItem) {
    if (!window.confirm(`Eliminare la capsula "${capsule.title}"? L'operazione non è reversibile.`))
      return;

    setBusyId(capsule.id);
    setError(null);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Devi essere autenticato.");

      await deleteCapsule(supabase, user.id, capsule);
      setCapsules((prev) => prev.filter((c) => c.id !== capsule.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossibile eliminare la capsula.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleOpenAttachment(capsule: CapsuleListItem, attachment: CapsuleAttachment) {
    setBusyAttachment(attachment.id);
    setError(null);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Devi essere autenticato.");

      const { filename, mimeType, bytes } = await downloadCapsuleAttachment(
        supabase,
        masterKey,
        user.id,
        capsule.id,
        attachment,
      );
      saveBytesAsFile(bytes, filename, mimeType);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossibile aprire l'allegato.");
    } finally {
      setBusyAttachment(null);
    }
  }

  /** Same download path Documenti itself uses --- a linked document is never copied, just referenced. */
  async function handleOpenLinkedDocument(doc: DocumentListItem) {
    setBusyAttachment(doc.id);
    setError(null);
    try {
      const { filename, mimeType, bytes } = await downloadDocument(supabase, masterKey, doc);
      saveBytesAsFile(bytes, filename, mimeType);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossibile aprire il documento.");
    } finally {
      setBusyAttachment(null);
    }
  }

  function toggleAttachmentTranscript(attachment: CapsuleAttachment) {
    if (transcribingAttachmentId === attachment.id) {
      setTranscribingAttachmentId(null);
      return;
    }
    setTranscribingAttachmentId(attachment.id);
    setTranscriptDraft(attachment.transcript ?? "");
    setTranscriptAutoMessage(null);
  }

  async function handleAutoTranscribeAttachment(capsule: CapsuleListItem, attachment: CapsuleAttachment) {
    setTranscriptAutoMessage(null);
    setTranscriptAutoBusy(true);
    setError(null);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Devi essere autenticato.");

      const { mimeType, bytes } = await downloadCapsuleAttachment(
        supabase,
        masterKey,
        user.id,
        capsule.id,
        attachment,
      );
      const result = await stubTranscriptionProvider.transcribe(bytes, mimeType);
      if (result) {
        setTranscriptDraft(result);
      } else {
        setTranscriptAutoMessage(
          "La trascrizione automatica non è ancora disponibile in questa versione (arriverà con l'AI reale, in un motore che gira interamente sul dispositivo). Scrivila tu qui sotto, nel frattempo.",
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossibile leggere l'allegato da trascrivere.");
    } finally {
      setTranscriptAutoBusy(false);
    }
  }

  async function saveAttachmentTranscript(capsule: CapsuleListItem, attachment: CapsuleAttachment) {
    setTranscriptSaving(true);
    setError(null);
    try {
      await updateCapsuleAttachmentTranscript(supabase, masterKey, capsule, attachment.id, transcriptDraft);
      // refresh() prima di chiudere il pannello: se lo si riapre subito
      // dopo, deve già trovare il testo appena salvato, non quello di
      // prima (attachment.transcript è letto una volta sola al click, non
      // si aggiorna da solo quando refresh() finisce più tardi).
      await refresh();
      setTranscribingAttachmentId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossibile salvare la trascrizione.");
    } finally {
      setTranscriptSaving(false);
    }
  }

  function sortValueFor(capsule: CapsuleListItem, column: SortColumn): string {
    switch (column) {
      case "title":
        return capsule.title;
      case "status":
        return STATUS_LABEL[capsule.status];
      case "recipients":
        return sortAlphabetically(capsule.relatedFriends, (c) => c.name)
          .map((c) => c.name)
          .join(", ");
      case "openAt":
        return capsule.openAt ? formatDateTime(capsule.openAt) : "";
      case "contents":
        return String(capsule.attachments.length + capsule.linkedDocuments.length);
    }
  }

  function handleSort(column: SortColumn) {
    setSort((prev) => toggleSort(prev, column));
  }

  const filteredCapsules = capsules
    .filter((capsule) => {
      const normalized = query.trim().toLowerCase();
      if (!normalized) return true;
      const transcripts = capsule.attachments.map((a) => a.transcript ?? "");
      return [capsule.title, capsule.content, ...transcripts].join(" ").toLowerCase().includes(normalized);
    })
    .filter((capsule) => statusFilter === "all" || capsule.status === statusFilter);

  // Solo la vista a tabella si ordina --- l'elenco resta cronologico.
  const sortedCapsules = applySort(filteredCapsules, sort, sortValueFor);

  // Si riclampa invece di resettare con un effect: se un filtro riduce i
  // risultati, la pagina torna da sola entro il range valido.
  const pageCount = Math.max(1, Math.ceil(filteredCapsules.length / TABLE_PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pagedCapsules = sortedCapsules.slice(
    (currentPage - 1) * TABLE_PAGE_SIZE,
    currentPage * TABLE_PAGE_SIZE,
  );

  return (
    <div className="flex flex-col gap-6 pb-[calc(3rem+env(safe-area-inset-bottom))] sm:pb-0">
      <div className="flex flex-col items-start gap-4 sm:flex-row sm:justify-between">
        <div className="min-w-0 w-full sm:flex-1">
          <h1 className="text-2xl font-semibold tracking-tight text-brand">
            Capsule
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Contenuti cifrati da lasciare a chi vuoi tu, in condizioni definite da te.
          </p>
          {/* Il dettaglio sull'irreversibilità resta comunque ripetuto al
              momento di chiudere davvero una capsula (v. handleClose,
              window.confirm) --- qui è solo per chi lo vuole leggere
              prima, non un secondo avviso obbligato: niente <p> lungo
              fisso in cima, specie su smartphone dove "mangiava" la
              maggior parte dello schermo (v. richiesta utente). */}
          <details className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            <summary className="cursor-pointer font-medium text-brand">Come funziona chiudere una capsula</summary>
            <p className="mt-1">
              Chiudere una capsula è irreversibile: non sarà più modificabile e ogni contenuto
              d&apos;Archivio ancora collegato viene copiato al suo interno --- l&apos;originale resta
              libero di essere modificato o cancellato. Non concede però ancora alcun accesso ai
              destinatari --- l&apos;apertura vera e propria arriverà con una fase futura.
            </p>
          </details>
        </div>
        <Link
          href="/capsules/new"
          className="hidden shrink-0 rounded-xl bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-hover sm:block"
        >
          + Crea capsula
        </Link>
      </div>

      <MobileAddFab href="/capsules/new" label="Aggiungi capsula" />

      {showCreatedMessage ? (
        <SuccessMessage>Capsula creata.</SuccessMessage>
      ) : null}
      {showUpdatedMessage ? (
        <SuccessMessage>Capsula aggiornata.</SuccessMessage>
      ) : null}

      {/* "Condivise con me" (FASE B) è una scheda qui dentro, non una voce
          di menu a parte --- stesso tipo di contenuto, solo guardato dal
          verso opposto (v. richiesta utente). */}
      <div className="flex w-fit gap-1 rounded-lg border border-zinc-200 p-1 dark:border-zinc-800">
        <button
          type="button"
          onClick={() => setActiveTab("mine")}
          aria-pressed={activeTab === "mine"}
          className={
            activeTab === "mine"
              ? "rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-white"
              : "rounded-md px-3 py-1.5 text-sm font-medium text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900"
          }
        >
          Le mie
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("shared")}
          aria-pressed={activeTab === "shared"}
          className={
            activeTab === "shared"
              ? "rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-white"
              : "rounded-md px-3 py-1.5 text-sm font-medium text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900"
          }
        >
          Condivise con me{sharedCapsules.length > 0 ? ` (${sharedCapsules.length})` : ""}
        </button>
      </div>

      {error ? (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : null}

      {activeTab === "shared" ? (
        sharedError ? (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {sharedError}
          </p>
        ) : sharedCapsules.length === 0 ? (
          <div className="rounded-lg border border-dashed border-zinc-300 p-8 text-center dark:border-zinc-700">
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Nessuna capsula condivisa con te, per ora.
            </p>
          </div>
        ) : (
          <ul className="flex flex-col divide-y divide-zinc-200 rounded-2xl border border-zinc-200 bg-white shadow-[0_8px_20px_rgba(16,24,40,0.04)] dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-950">
            {sharedCapsules.map((shared) => {
              // FASE C1 --- il vero sblocco: prima di questa data, il
              // database nega comunque la lettura della busta cifrata
              // (v. migrazione capsule_share_keys), qui il controllo è
              // solo per decidere se mostrare il tasto "Apri" o il
              // countdown.
              const canOpen = shared.openAt !== null && new Date(shared.openAt) <= new Date();

              return (
                <li key={shared.id} className="flex flex-col gap-2 p-4">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                      Da {shared.ownerName}
                    </span>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE_CLASS[shared.status]}`}
                    >
                      {STATUS_LABEL[shared.status]}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    Condivisa il {formatDate(shared.sharedAt)}
                    {shared.openAt ? ` · apertura prevista ${formatDateTime(shared.openAt)}` : ""}
                  </p>

                  {shared.openAt && showCountdown ? (
                    <div className="mt-1">
                      <CapsuleCountdown createdAt={shared.sharedAt} openAt={shared.openAt} size="sm" />
                    </div>
                  ) : null}

                  {canOpen ? (
                    <button
                      type="button"
                      onClick={() => setOpeningShared(shared)}
                      className="mt-1 w-fit rounded-md bg-brand px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-hover"
                    >
                      🔓 Apri
                    </button>
                  ) : (
                    <p className="text-xs text-zinc-400 dark:text-zinc-500">
                      Potrai aprirla quando arriverà la data di apertura.
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        )
      ) : loading ? (
        <ListSkeleton />
      ) : capsules.length === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-300 p-8 text-center dark:border-zinc-700">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Nessuna capsula ancora. Creane una col tasto qui sopra.
          </p>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-3">
            <SearchInput value={query} onChange={setQuery} placeholder="Cerca per titolo o contenuto…" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as CapsuleStatus | "all")}
              aria-label="Filtra per stato"
              className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
            >
              <option value="all">Tutte</option>
              <option value="draft">Bozza</option>
              <option value="ready">Chiusa</option>
              <option value="shared">Condivisa</option>
            </select>
            <ListViewToggle section="capsules" hideOnMobile />
          </div>

          {filteredCapsules.length === 0 ? (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Nessuna capsula corrisponde alla ricerca.
            </p>
          ) : viewMode === "table" ? (
            <div className="flex flex-col gap-3">
              <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white shadow-[0_8px_20px_rgba(16,24,40,0.04)] dark:border-zinc-800 dark:bg-zinc-950">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-200 text-left text-xs font-medium text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                      <SortableColumnHeader label="Titolo" sortKey="title" sort={sort} onSort={handleSort} />
                      <SortableColumnHeader label="Stato" sortKey="status" sort={sort} onSort={handleSort} />
                      <SortableColumnHeader
                        label="Destinatari"
                        sortKey="recipients"
                        sort={sort}
                        onSort={handleSort}
                      />
                      <SortableColumnHeader
                        label="Apertura"
                        sortKey="openAt"
                        sort={sort}
                        onSort={handleSort}
                      />
                      {showCountdown ? (
                        // Non ordinabile --- stesso ordine di "Apertura", da cui deriva
                        // (v. richiesta utente: colonna propria, non integrata lì dentro).
                        <th className="p-3">
                          Tra quanto
                          <span className="mt-0.5 block text-[9px] font-semibold tracking-wide text-zinc-400 normal-case dark:text-zinc-500">
                            gg&nbsp;&nbsp;hh&nbsp;&nbsp;mm&nbsp;&nbsp;ss
                          </span>
                        </th>
                      ) : null}
                      <SortableColumnHeader
                        label="Contenuti"
                        sortKey="contents"
                        sort={sort}
                        onSort={handleSort}
                      />
                      <th className="p-3">Azioni</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                    {pagedCapsules.map((capsule) => {
                      const busy = busyId === capsule.id;
                      const contentCount = capsule.attachments.length + capsule.linkedDocuments.length;

                      return (
                        <tr key={capsule.id}>
                          <td className="max-w-[14rem] truncate p-3 font-medium text-zinc-900 dark:text-zinc-100">
                            {capsule.title}
                          </td>
                          <td className="p-3">
                            <span
                              className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE_CLASS[capsule.status]}`}
                            >
                              {STATUS_LABEL[capsule.status]}
                            </span>
                          </td>
                          <td className="max-w-[12rem] truncate p-3 text-zinc-600 dark:text-zinc-400">
                            {capsule.relatedFriends.length > 0
                              ? sortAlphabetically(capsule.relatedFriends, (c) => c.name)
                                  .map((c) => c.name)
                                  .join(", ")
                              : "—"}
                          </td>
                          <td className="p-3 text-zinc-600 dark:text-zinc-400">
                            {capsule.openAt ? formatDateTime(capsule.openAt) : "—"}
                          </td>
                          {showCountdown ? (
                            <td className="p-3">
                              {capsule.openAt && capsule.status !== "draft" ? (
                                <CapsuleCountdown createdAt={capsule.createdAt} openAt={capsule.openAt} size="xs" />
                              ) : (
                                <span className="text-zinc-400 dark:text-zinc-600">—</span>
                              )}
                            </td>
                          ) : null}
                          <td className="p-3 text-zinc-600 dark:text-zinc-400">{contentCount}</td>
                          <td className="p-3">
                            <RowActionsMenu label={`Azioni per "${capsule.title}"`}>
                              <RowMenuItem disabled={busy} onClick={() => setPreviewCapsule(capsule)}>
                                👁️ Anteprima
                              </RowMenuItem>
                              {capsule.status === "draft" ? (
                                <RowMenuItem disabled={busy} onClick={() => router.push(`/capsules/${capsule.id}/edit`)}>
                                  Modifica
                                </RowMenuItem>
                              ) : null}
                              {capsule.status === "draft" ? (
                                <RowMenuItem disabled={busy} onClick={() => handleClose(capsule)}>
                                  Chiudi
                                </RowMenuItem>
                              ) : null}
                              {capsule.status === "ready" ? (
                                <RowMenuItem disabled={busy} onClick={() => handleShare(capsule)}>
                                  Condividi
                                </RowMenuItem>
                              ) : null}
                              <RowMenuItem disabled={busy} danger onClick={() => handleDelete(capsule)}>
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
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Passa alla vista a elenco per aprire i singoli contenuti di una capsula.
              </p>
              <Pagination page={currentPage} pageCount={pageCount} onChange={setPage} />
            </div>
          ) : (
            <ul className="flex flex-col divide-y divide-zinc-200 rounded-2xl border border-zinc-200 bg-white shadow-[0_8px_20px_rgba(16,24,40,0.04)] dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-950">
              {filteredCapsules.map((capsule) => {
                const busy = busyId === capsule.id;

                return (
                  <li key={capsule.id} className="flex flex-col gap-3 p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="flex items-center gap-2">
                          <span className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
                            {capsule.title}
                          </span>
                          <span
                            className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE_CLASS[capsule.status]}`}
                          >
                            {STATUS_LABEL[capsule.status]}
                          </span>
                        </p>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">
                          {capsule.relatedFriends.length > 0
                            ? `Per ${sortAlphabetically(capsule.relatedFriends, (c) => c.name)
                                .map((c) => c.name)
                                .join(", ")} · `
                            : ""}
                          dal {formatDate(capsule.createdAt)}
                          {capsule.openAt ? ` · apertura prevista ${formatDateTime(capsule.openAt)}` : ""}
                        </p>
                        {capsule.openAt && capsule.status !== "draft" && showCountdown ? (
                          <div className="mt-1.5">
                            <CapsuleCountdown createdAt={capsule.createdAt} openAt={capsule.openAt} size="sm" showProgress />
                          </div>
                        ) : null}
                      </div>
                      <RowActionsMenu label={`Azioni per "${capsule.title}"`}>
                        <RowMenuItem disabled={busy} onClick={() => setPreviewCapsule(capsule)}>
                          👁️ Anteprima
                        </RowMenuItem>
                        {capsule.status === "draft" ? (
                          <RowMenuItem disabled={busy} onClick={() => router.push(`/capsules/${capsule.id}/edit`)}>
                            Modifica
                          </RowMenuItem>
                        ) : null}
                        {capsule.status === "draft" ? (
                          <RowMenuItem disabled={busy} onClick={() => handleClose(capsule)}>
                            Chiudi la capsula
                          </RowMenuItem>
                        ) : null}
                        {capsule.status === "ready" ? (
                          <RowMenuItem disabled={busy} onClick={() => handleShare(capsule)}>
                            Condividi
                          </RowMenuItem>
                        ) : null}
                        <RowMenuItem disabled={busy} danger onClick={() => handleDelete(capsule)}>
                          Elimina
                        </RowMenuItem>
                      </RowActionsMenu>
                    </div>

                    {capsule.attachments.length > 0 || capsule.linkedDocuments.length > 0 ? (
                      <ul className="flex flex-col gap-1">
                        {capsule.attachments.map((attachment) => {
                          const kind = contentKindFor(attachment.mimeType);
                          const isTranscribingThis = transcribingAttachmentId === attachment.id;
                          return (
                            <li key={attachment.id} className="flex flex-col gap-1.5">
                              <div className="flex items-center justify-between gap-3 rounded-md bg-zinc-50 px-3 py-1.5 text-xs dark:bg-zinc-900">
                                <span className="truncate text-zinc-700 dark:text-zinc-300">
                                  {CONTENT_KIND_ICON[kind]} {attachment.filename} · {formatSize(attachment.size)}
                                </span>
                                <div className="flex shrink-0 gap-3">
                                  {isTranscribable(kind) ? (
                                    <button
                                      type="button"
                                      onClick={() => toggleAttachmentTranscript(attachment)}
                                      className="font-medium text-zinc-600 underline-offset-2 hover:underline dark:text-zinc-400"
                                    >
                                      📝 {isTranscribingThis ? "Chiudi" : "Trascrizione"}
                                    </button>
                                  ) : null}
                                  <button
                                    type="button"
                                    disabled={busyAttachment === attachment.id}
                                    onClick={() => handleOpenAttachment(capsule, attachment)}
                                    className="font-medium text-zinc-600 underline-offset-2 hover:underline disabled:opacity-50 dark:text-zinc-400"
                                  >
                                    {busyAttachment === attachment.id ? "Apertura…" : "Apri"}
                                  </button>
                                </div>
                              </div>
                              {isTranscribingThis ? (
                                <div className="flex flex-col gap-2 rounded-md bg-zinc-50 p-3 dark:bg-zinc-900">
                                  <div className="flex items-center justify-between gap-3">
                                    <label
                                      htmlFor={`transcript-${attachment.id}`}
                                      className="text-xs font-medium text-zinc-600 dark:text-zinc-400"
                                    >
                                      Trascrizione
                                    </label>
                                    <button
                                      type="button"
                                      disabled={transcriptAutoBusy}
                                      onClick={() => handleAutoTranscribeAttachment(capsule, attachment)}
                                      className="text-xs font-medium text-zinc-600 underline-offset-2 hover:underline disabled:opacity-50 dark:text-zinc-400"
                                    >
                                      {transcriptAutoBusy ? "Provo…" : "Trascrivi automaticamente"}
                                    </button>
                                  </div>
                                  {transcriptAutoMessage ? (
                                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                                      {transcriptAutoMessage}
                                    </p>
                                  ) : null}
                                  <textarea
                                    id={`transcript-${attachment.id}`}
                                    rows={4}
                                    value={transcriptDraft}
                                    onChange={(e) => setTranscriptDraft(e.target.value)}
                                    placeholder="Scrivi qui la trascrizione, o provaci con il tasto qui sopra…"
                                    className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
                                  />
                                  <div className="flex gap-3">
                                    <button
                                      type="button"
                                      disabled={transcriptSaving}
                                      onClick={() => saveAttachmentTranscript(capsule, attachment)}
                                      className="self-start rounded-xl bg-brand px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-hover disabled:opacity-50"
                                    >
                                      {transcriptSaving ? "Salvataggio…" : "Salva trascrizione"}
                                    </button>
                                  </div>
                                </div>
                              ) : null}
                            </li>
                          );
                        })}
                        {capsule.linkedDocuments.map((doc) => (
                          <li
                            key={doc.id}
                            className="flex items-center justify-between gap-3 rounded-md bg-zinc-50 px-3 py-1.5 text-xs dark:bg-zinc-900"
                          >
                            <span className="truncate text-zinc-700 dark:text-zinc-300">
                              {CONTENT_KIND_ICON[contentKindFor(doc.mimeType)]} {doc.filename} · {formatSize(doc.size)}
                            </span>
                            <button
                              type="button"
                              disabled={busyAttachment === doc.id}
                              onClick={() => handleOpenLinkedDocument(doc)}
                              className="shrink-0 font-medium text-zinc-600 underline-offset-2 hover:underline disabled:opacity-50 dark:text-zinc-400"
                            >
                              {busyAttachment === doc.id ? "Apertura…" : "Apri"}
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}

      {/* Sempre montato (non condizionato a previewCapsule) --- gestisce da
          sé mount/unmount per animare la dissolvenza in uscita (v.
          richiesta utente), altrimenti sparirebbe di scatto insieme a
          previewCapsule prima di poter animare nulla. */}
      <CapsulePreview
        masterKey={masterKey}
        capsule={previewCapsule}
        showCountdown={showCountdown}
        onClose={() => setPreviewCapsule(null)}
      />

      {/* FASE C1 --- sempre montato per lo stesso motivo di CapsulePreview qui sopra. */}
      <SharedCapsuleViewer
        masterKey={masterKey}
        capsuleId={openingShared?.id ?? null}
        ownerId={openingShared?.ownerId ?? ""}
        ownerName={openingShared?.ownerName ?? ""}
        onClose={() => setOpeningShared(null)}
      />
    </div>
  );
}
