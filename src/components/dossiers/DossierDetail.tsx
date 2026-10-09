"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useSupabase } from "@/lib/db/supabase/use-supabase";
import {
  addDossierPerson,
  addDossierStep,
  addExpectedItem,
  deleteDossier,
  deleteDossierItem,
  deleteExpectedItem,
  listDossierItems,
  listDossiers,
  listExpectedItems,
  replaceDocumentDossierLinks,
  setDossierPhases,
  setDossierStatus,
  setDossierStepDone,
  setDossierSummary,
  setExpectedItemDone,
  type DossierItems,
} from "@/domain/dossiers/repository";
import { matchExpected, type ExpectedItem } from "@/domain/dossiers/expected";
import { normalizePhases } from "@/domain/dossiers/phases";
import {
  documentSuggestionKey,
  loadDismissedSuggestions,
  saveDismissedSuggestions,
  suggestDocumentsForDossier,
} from "@/domain/dossiers/suggestions";
import { buildLivingTimeline, dossierOverview } from "@/domain/dossiers/overview";
import { buildSummaryRequest, readableDocumentCount } from "@/domain/ai/dossier-summary";
import { requestDossierSummary } from "@/domain/dossiers/summary-client";
import { useAIProcessingConsent } from "@/components/ai/AIProcessingConsentProvider";
import { DossierSummaryCard } from "@/components/dossiers/DossierSummaryCard";
import { createTextNote, getDocumentsByIds, listDocumentSummaries } from "@/domain/documents/repository";
import { listAssets } from "@/domain/assets/repository";
import { listReminders } from "@/domain/reminders/repository";
import { relativeDay } from "@/domain/documents/archive-views";
import { formatDate } from "@/lib/format";
import { useToast } from "@/components/ui/ToastProvider";
import { DossierTimeline } from "@/components/dossiers/DossierTimeline";
import { ExpectedItemsCard } from "@/components/dossiers/ExpectedItemsCard";
import { DossierNextSteps } from "@/components/dossiers/DossierNextSteps";
import { DossierInvolved } from "@/components/dossiers/DossierInvolved";
import { PhasesBar, PhasesEditor } from "@/components/dossiers/PhasesBar";
import { CandidatesCard, DeadlinesCard, ExpensesCard, ReadingsCard } from "@/components/dossiers/DossierSideCards";
import { GHOST_BUTTON } from "@/components/dossiers/styles";
import type { AssetListItem } from "@/domain/assets/types";
import type { DossierListItem } from "@/domain/dossiers/types";
import type { DocumentListItem, DocumentSummary } from "@/domain/documents/types";
import type { ReminderListItem } from "@/domain/reminders/types";

/**
 * La scheda di un fascicolo: titolo, descrizione, stato, e la vicenda che racconta, in gran parte ricavata dai suoi
 * documenti: la cronologia (documenti, note e scadenze in un'unica linea), le prossime scadenze, le spese lette dai
 * documenti, i beni coinvolti. Il resto lo scrive l'utente, ed è tutto facoltativo: le fasi, i documenti attesi, i
 * prossimi passi, le persone. Una sezione senza dati non compare. Chi collega un documento al fascicolo lo fa dal form
 * del documento; le note nascono qui, come note dell'Archivio collegate al fascicolo.
 */
export function DossierDetail({ masterKey, dossierId }: { masterKey: CryptoKey; dossierId: string }) {
  const supabase = useSupabase();
  const router = useRouter();
  const searchParams = useSearchParams();
  const showToast = useToast();
  const { masterEnabled, extractionConsent } = useAIProcessingConsent();

  const [dossier, setDossier] = useState<DossierListItem | null>(null);
  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  const [assets, setAssets] = useState<AssetListItem[]>([]);
  const [reminders, setReminders] = useState<ReminderListItem[]>([]);
  const [now] = useState(() => new Date());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [noteText, setNoteText] = useState("");
  const [noteBusy, setNoteBusy] = useState(false);
  // null = la tabella non c'è ancora (migrazione non applicata): il riquadro non compare.
  const [expectedItems, setExpectedItems] = useState<ExpectedItem[] | null>(null);
  const [items, setItems] = useState<DossierItems | null>(null);
  const [itemsBusy, setItemsBusy] = useState(false);
  const [adding, setAdding] = useState({ expected: false, steps: false, people: false });
  const [editingPhases, setEditingPhases] = useState(false);
  const [dismissed, setDismissed] = useState<ReadonlySet<string>>(new Set());
  const [suggestionBusy, setSuggestionBusy] = useState(false);
  const [summaryBusy, setSummaryBusy] = useState(false);
  const [summaryNotice, setSummaryNotice] = useState<string | null>(null);
  const [readings, setReadings] = useState<DocumentListItem[] | null>(null);
  const [readingsBusy, setReadingsBusy] = useState(false);

  const latestRequestRef = useRef(0);

  const refresh = useCallback(async () => {
    const requestId = ++latestRequestRef.current;
    setError(null);
    try {
      const [dossiers, documentsResult, assetsResult, remindersResult, expectedResult, itemsResult] = await Promise.all([
        listDossiers(supabase, masterKey),
        listDocumentSummaries(supabase, masterKey),
        listAssets(supabase, masterKey),
        // Un di più: se le scadenze non si leggono, la scheda mostra comunque i documenti.
        listReminders(supabase, masterKey).catch((): ReminderListItem[] => []),
        listExpectedItems(supabase, masterKey, dossierId).catch((): null => null),
        listDossierItems(supabase, masterKey, dossierId).catch((): null => null),
      ]);
      if (requestId !== latestRequestRef.current) return;
      setExpectedItems(expectedResult);
      setItems(itemsResult);
      setDossier(dossiers.find((d) => d.id === dossierId) ?? null);
      setDocuments(documentsResult);
      setAssets(assetsResult);
      setReminders(remindersResult);
    } catch (err) {
      if (requestId !== latestRequestRef.current) return;
      setError(err instanceof Error ? err.message : "Impossibile caricare il fascicolo.");
    } finally {
      if (requestId === latestRequestRef.current) setLoading(false);
    }
  }, [supabase, masterKey, dossierId]);

  useEffect(() => {
    // See DocumentsPanel.tsx for why fetch-on-mount is legitimate here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
  }, [refresh]);

  useEffect(() => {
    // I "Non ora" stanno sul dispositivo: si leggono dopo il montaggio, lo storage non esiste sul server.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDismissed(loadDismissedSuggestions());
  }, []);

  // "?created=1"/"?updated=1" --- stesso schema di CapsulesPanel.tsx.
  const [showCreatedMessage] = useState(() => searchParams.get("created") === "1");
  const [showUpdatedMessage] = useState(() => searchParams.get("updated") === "1");
  useEffect(() => {
    if (showCreatedMessage) showToast("Fascicolo creato.");
    if (showUpdatedMessage) showToast("Fascicolo aggiornato.");
    if (showCreatedMessage || showUpdatedMessage) router.replace(`/dossiers/${dossierId}`);
  }, [showCreatedMessage, showUpdatedMessage, router, showToast, dossierId]);

  /** Il giro di ogni modifica a fasi, passi, persone e documenti attesi: occupato, esegui, ricarica, errore leggibile. */
  async function runItemsAction(action: (userId: string) => Promise<void>, failure: string) {
    setItemsBusy(true);
    setError(null);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Devi essere autenticato.");
      await action(user.id);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : failure);
    } finally {
      setItemsBusy(false);
    }
  }

  async function handleToggleStatus() {
    if (!dossier) return;
    setBusy(true);
    setError(null);
    try {
      const next = dossier.status === "open" ? "closed" : "open";
      await setDossierStatus(supabase, dossierId, next);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossibile aggiornare lo stato.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!dossier) return;
    if (
      !window.confirm(
        `Eliminare il fascicolo "${dossier.title}"? I documenti collegati non verranno eliminati, solo scollegati.`,
      )
    )
      return;

    setBusy(true);
    setError(null);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Devi essere autenticato.");
      await deleteDossier(supabase, user.id, dossierId);
      router.push("/dossiers?deleted=1");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossibile eliminare il fascicolo.");
      setBusy(false);
    }
  }

  /** Una nota è una nota dell'Archivio collegata al fascicolo: niente di nuovo da gestire, e si ritrova anche in Archivio. */
  async function handleAddNote() {
    const text = noteText.trim();
    if (!text) return;
    setNoteBusy(true);
    setError(null);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Devi essere autenticato.");
      const title = text.split("\n")[0].slice(0, 60);
      await createTextNote(supabase, masterKey, user.id, { title, body: text }, {
        categoryId: null,
        relatedAssetId: null,
        dossierIds: [dossierId],
        expiresAt: null,
        notes: "",
        tags: [],
        issuer: "",
      });
      setNoteText("");
      await refresh();
      showToast("Nota aggiunta.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossibile aggiungere la nota.");
    } finally {
      setNoteBusy(false);
    }
  }

  function handleDismissCandidate(documentId: string) {
    const next = new Set(dismissed).add(documentSuggestionKey(dossierId, documentId));
    setDismissed(next);
    saveDismissedSuggestions(next);
  }

  /** Aggiunge il documento al fascicolo, tenendo gli altri fascicoli in cui già sta. */
  async function handleAddCandidate(documentId: string) {
    const target = documents.find((d) => d.id === documentId);
    if (!target) return;
    setSuggestionBusy(true);
    setError(null);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Devi essere autenticato.");
      await replaceDocumentDossierLinks(supabase, user.id, documentId, [...target.dossierIds, dossierId]);
      await refresh();
      showToast("Documento aggiunto al fascicolo.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossibile aggiungere il documento.");
    } finally {
      setSuggestionBusy(false);
    }
  }

  /**
   * Il riassunto: le sintesi dei documenti già letti partono verso Claude (il server ricontrolla i permessi) e il testo
   * che torna si salva cifrato nel fascicolo. Nessun documento viene riletto.
   */
  async function handleWriteSummary() {
    if (!dossier) return;
    setSummaryBusy(true);
    setSummaryNotice(null);
    setError(null);
    try {
      const readableIds = documents.filter((d) => d.dossierIds.includes(dossierId) && d.aiSynthesisGeneratedAt !== null).map((d) => d.id);
      const request = buildSummaryRequest(dossier.title, await getDocumentsByIds(supabase, masterKey, readableIds));
      if (request.documents.length === 0) throw new Error("Hinthia non ha ancora letto nessun documento di questo fascicolo.");
      const result = await requestDossierSummary(request);
      await setDossierSummary(supabase, masterKey, dossierId, {
        text: result.summary,
        generatedAt: new Date().toISOString(),
        documentCount: result.used,
        readableCount: readableIds.length,
      });
      if (result.skipped > 0) {
        setSummaryNotice(
          `${result.skipped} ${result.skipped === 1 ? "documento è rimasto fuori" : "documenti sono rimasti fuori"}: ${
            result.skipped === 1 ? "è escluso" : "sono esclusi"
          } dall'analisi o di una categoria non abilitata.`,
        );
      }
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossibile scrivere il riassunto.");
    } finally {
      setSummaryBusy(false);
    }
  }

  async function handleRemoveSummary() {
    setSummaryBusy(true);
    setError(null);
    try {
      await setDossierSummary(supabase, masterKey, dossierId, null);
      setSummaryNotice(null);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossibile eliminare il riassunto.");
    } finally {
      setSummaryBusy(false);
    }
  }

  /** Le sintesi sono già nei documenti letti da Hinthia: si leggono solo quando le chiedi, e nessuna nuova lettura parte. */
  async function handleShowReadings(ids: string[]) {
    setReadingsBusy(true);
    setError(null);
    try {
      setReadings(await getDocumentsByIds(supabase, masterKey, ids));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossibile leggere i documenti.");
    } finally {
      setReadingsBusy(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-zinc-500 dark:text-zinc-400">Caricamento…</p>;
  }

  if (!dossier) {
    return (
      <div className="flex flex-col gap-4">
        <Link
          href="/dossiers"
          className="text-sm font-medium text-zinc-500 underline-offset-2 hover:underline dark:text-zinc-400"
        >
          ← Torna ai fascicoli
        </Link>
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          Fascicolo non trovato.
        </p>
      </div>
    );
  }

  const isClosed = dossier.status === "closed";
  const linkedDocuments = documents.filter((doc) => doc.dossierIds.includes(dossierId));
  const overview = dossierOverview({ documents: linkedDocuments, reminders, assets, steps: items?.steps, now });
  const timeline = buildLivingTimeline(linkedDocuments, reminders);
  const candidates = isClosed ? [] : suggestDocumentsForDossier({ dossierId, documents, assets, dismissed });
  const expected = expectedItems ? matchExpected(expectedItems, linkedDocuments) : null;
  const steps = items?.steps ?? [];
  const people = items?.people ?? [];

  const showExpected = expected !== null && (expected.total > 0 || adding.expected);
  const showSteps = items !== null && (steps.length > 0 || adding.steps);
  const showInvolved = overview.assets.length > 0 || people.length > 0 || adding.people;
  const phases = dossier.phases;
  const readable = readableDocumentCount(linkedDocuments);
  const canWriteSummary = masterEnabled && extractionConsent;
  const showSummary = dossier.summary !== null || (canWriteSummary && readable > 0);

  // I pulsanti "+ ..." per le sezioni facoltative non ancora usate: il fascicolo resta leggero finché non servono.
  const addButtons = isClosed
    ? []
    : [
        ...(!phases && !editingPhases ? [{ label: "+ Fasi", onClick: () => setEditingPhases(true) }] : []),
        ...(expected !== null && !showExpected ? [{ label: "+ Documenti attesi", onClick: () => setAdding((a) => ({ ...a, expected: true })) }] : []),
        ...(items !== null && !showSteps ? [{ label: "+ Prossimi passi", onClick: () => setAdding((a) => ({ ...a, steps: true })) }] : []),
        ...(items !== null && !showInvolved ? [{ label: "+ Persone", onClick: () => setAdding((a) => ({ ...a, people: true })) }] : []),
      ];

  return (
    <div className="flex flex-col gap-6 text-[#121a35] dark:text-zinc-100">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1.5">
          <Link
            href="/dossiers"
            className="self-start text-[13.5px] font-bold text-brand underline-offset-2 hover:underline"
          >
            ← Torna ai fascicoli
          </Link>
          <div className="flex flex-wrap items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[13px] bg-[#e8edfc] dark:bg-brand/20">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#2b4fc4" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
              </svg>
            </span>
            <h1 className="min-w-0 font-heading text-[30px] leading-tight font-extrabold tracking-[-0.02em] break-words text-brand">{dossier.title}</h1>
            <span
              className={`rounded-full px-[11px] py-1 text-[12.5px] font-bold ${
                isClosed ? "bg-[#eceff4] text-[#5b6483] dark:bg-zinc-800 dark:text-zinc-300" : "bg-[#e8edfc] text-brand dark:bg-brand/20 dark:text-[#9db6ff]"
              }`}
            >
              {isClosed ? "Chiuso" : "Aperto"}
            </span>
          </div>
          <p className="text-[13.5px] text-[#5b6483] dark:text-zinc-400">
            {isClosed ? `Chiuso il ${formatDate(dossier.closedAt!)}` : "Aperto"} · creato il {formatDate(dossier.createdAt)} ·{" "}
            {overview.documentCount} {overview.documentCount === 1 ? "documento" : "documenti"}
            {overview.lastUpdate ? ` · ultimo ${relativeDay(overview.lastUpdate, now)}` : ""}
          </p>
          {dossier.description ? (
            <p className="max-w-3xl text-sm whitespace-pre-wrap text-zinc-700 dark:text-zinc-300">{dossier.description}</p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2.5">
          <Link
            href={`/dossiers/${dossierId}/share`}
            className="flex items-center gap-1.5 rounded-xl border-[1.5px] border-[#c9d0e6] bg-white px-4 py-2 text-sm font-semibold text-brand hover:border-brand dark:border-zinc-700 dark:bg-zinc-950"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" />
              <path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
            </svg>
            Condividi
          </Link>
          <Link
            href={`/dossiers/${dossierId}/edit`}
            className="rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-hover"
          >
            Modifica
          </Link>
          <button
            type="button"
            disabled={busy}
            onClick={handleToggleStatus}
            className="rounded-xl border-[1.5px] border-[#c9d0e6] bg-white px-4 py-2 text-sm font-semibold text-[#121a35] hover:border-brand disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
          >
            {isClosed ? "Riapri fascicolo" : "Chiudi fascicolo"}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={handleDelete}
            className="rounded-xl border-[1.5px] border-red-300 bg-white px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50 dark:border-red-900 dark:bg-zinc-950 dark:text-red-400 dark:hover:bg-red-950"
          >
            Elimina
          </button>
        </div>
      </div>

      {error ? (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : null}

      {addButtons.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Aggiungi al fascicolo">
          {addButtons.map((button) => (
            <button key={button.label} type="button" onClick={button.onClick} className={GHOST_BUTTON}>
              {button.label}
            </button>
          ))}
        </div>
      ) : null}

      {editingPhases ? (
        <PhasesEditor
          initial={phases}
          busy={itemsBusy}
          onCancel={() => setEditingPhases(false)}
          onSave={(names) => {
            const next = normalizePhases({ names, current: phases ? phases.current : 0 });
            void runItemsAction(async () => {
              await setDossierPhases(supabase, masterKey, dossierId, next);
              setEditingPhases(false);
            }, "Impossibile salvare le fasi.");
          }}
        />
      ) : phases ? (
        <PhasesBar
          phases={phases}
          disabled={itemsBusy || isClosed}
          onEdit={() => setEditingPhases(true)}
          onSelect={(index) => {
            // Subito, senza aspettare la rete: la fase deve cambiare al clic.
            const next = { ...phases, current: index };
            setDossier((d) => (d ? { ...d, phases: next } : d));
            void runItemsAction(() => setDossierPhases(supabase, masterKey, dossierId, next), "Impossibile spostare la fase.");
          }}
        />
      ) : null}

      <div className="flex flex-col items-stretch gap-5 lg:flex-row lg:items-start">
        <div className="flex min-w-0 flex-1 flex-col gap-5">
          {showSummary ? (
            <DossierSummaryCard
              summary={dossier.summary}
              readable={readable}
              canWrite={canWriteSummary}
              busy={summaryBusy}
              notice={summaryNotice}
              now={now}
              onWrite={() => void handleWriteSummary()}
              onRemove={() => void handleRemoveSummary()}
            />
          ) : null}
          <DossierTimeline
            timeline={timeline}
            noteText={noteText}
            noteBusy={noteBusy}
            onNoteChange={setNoteText}
            onAddNote={() => void handleAddNote()}
          />
        </div>

        <div className="flex w-full shrink-0 flex-col gap-4 lg:w-[300px]">
          {showExpected && expected ? (
            <ExpectedItemsCard
              expected={expected}
              busy={itemsBusy}
              onAdd={(labels) =>
                void runItemsAction(async (userId) => {
                  for (const label of labels) await addExpectedItem(supabase, masterKey, userId, dossierId, label);
                }, "Impossibile aggiungere il documento atteso.")
              }
              onToggle={(status, checked) => {
                // Subito, senza aspettare la rete: la spunta deve rispondere al clic.
                setExpectedItems((list) => list?.map((i) => (i.id === status.item.id ? { ...i, done: checked } : i)) ?? list);
                void runItemsAction(() => setExpectedItemDone(supabase, status.item.id, checked), "Impossibile aggiornare i documenti attesi.");
              }}
              onDelete={(status) =>
                void runItemsAction(() => deleteExpectedItem(supabase, status.item.id), "Impossibile togliere il documento atteso.")
              }
            />
          ) : null}

          {showSteps ? (
            <DossierNextSteps
              steps={steps}
              now={now}
              busy={itemsBusy}
              onAdd={(text, dueOn) =>
                void runItemsAction(
                  (userId) => addDossierStep(supabase, masterKey, userId, dossierId, { text, dueOn }),
                  "Impossibile aggiungere il passo.",
                )
              }
              onToggle={(step, done) => {
                setItems((current) =>
                  current ? { ...current, steps: current.steps.map((s) => (s.id === step.id ? { ...s, done } : s)) } : current,
                );
                void runItemsAction(() => setDossierStepDone(supabase, step.id, done), "Impossibile aggiornare il passo.");
              }}
              onDelete={(step) => void runItemsAction(() => deleteDossierItem(supabase, step.id), "Impossibile togliere il passo.")}
            />
          ) : null}

          {candidates.length > 0 ? (
            <CandidatesCard
              candidates={candidates}
              busy={suggestionBusy}
              onAdd={(documentId) => void handleAddCandidate(documentId)}
              onDismiss={handleDismissCandidate}
            />
          ) : null}

          {overview.deadlines.length > 0 ? <DeadlinesCard deadlines={overview.deadlines} /> : null}

          {overview.expenses ? <ExpensesCard expenses={overview.expenses} /> : null}

          {showInvolved ? (
            <DossierInvolved
              assets={overview.assets}
              people={people}
              busy={itemsBusy}
              adding={adding.people}
              canAddPeople={items !== null && !isClosed}
              onAddPerson={(name, role) =>
                void runItemsAction(
                  (userId) => addDossierPerson(supabase, masterKey, userId, dossierId, { name, role }),
                  "Impossibile aggiungere la persona.",
                )
              }
              onDeletePerson={(person) => void runItemsAction(() => deleteDossierItem(supabase, person.id), "Impossibile togliere la persona.")}
            />
          ) : null}

          {linkedDocuments.length > 0 ? (
            <ReadingsCard
              readings={readings}
              busy={readingsBusy}
              onShow={() => void handleShowReadings(linkedDocuments.map((d) => d.id))}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
