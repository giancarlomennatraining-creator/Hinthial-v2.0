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
import { starterHref } from "@/domain/capsules/starter";
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
import { RowActionsMenu, RowMenuItem } from "@/components/ui/RowActionsMenu";
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
import { BackLink, ContextBackLink } from "@/components/ui/BackLink";
import { useConfirm } from "@/components/ui/ConfirmProvider";

/**
 * La scheda di un fascicolo: titolo, descrizione, stato, e la vicenda che racconta, in gran parte ricavata dai suoi
 * documenti: la cronologia (documenti, note e scadenze in un'unica linea), le prossime scadenze, le spese lette dai
 * documenti, i beni coinvolti. Il resto lo scrive l'utente, ed è tutto facoltativo: le fasi, i documenti attesi, i
 * prossimi passi, le persone. Una sezione senza dati non compare. Chi collega un documento al fascicolo lo fa dal form
 * del documento; le note nascono qui, come note dell'Archivio collegate al fascicolo.
 */
export function DossierDetail({ masterKey, dossierId }: { masterKey: CryptoKey; dossierId: string }) {
  const supabase = useSupabase();
  const confirm = useConfirm();
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
      !(await confirm({
        message: `Eliminare il fascicolo "${dossier.title}"? I documenti collegati non verranno eliminati, solo scollegati.`,
        confirmLabel: "Elimina",
        danger: true,
      }))
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
        <BackLink href="/dossiers">Torna ai fascicoli</BackLink>
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
    <div className="flex flex-col gap-6 text-zinc-900 dark:text-zinc-100">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1.5">
          <ContextBackLink parent={{ href: "/dossiers", label: "Torna ai fascicoli" }} />
          <div className="flex flex-wrap items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[13px] bg-brand/10 dark:bg-brand/20">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
              </svg>
            </span>
            <h1 className="min-w-0 text-[30px] leading-tight font-extrabold tracking-[-0.02em] break-words text-title">{dossier.title}</h1>
            <span
              className={`rounded-full px-[11px] py-1 text-[12.5px] font-bold ${
                isClosed ? "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-300" : "bg-brand/10 text-accent dark:bg-brand/20 dark:text-accent"
              }`}
            >
              {isClosed ? "Chiuso" : "Aperto"}
            </span>
          </div>
          <p className="text-[13.5px] text-zinc-500 dark:text-zinc-400">
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
            className="flex items-center gap-1.5 rounded-xl border-[1.5px] border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-accent hover:border-brand dark:border-zinc-700 dark:bg-zinc-950"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" />
              <path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
            </svg>
            Condividi
          </Link>
          <Link
            href={starterHref("fascicolo", dossierId)}
            className="flex items-center gap-1.5 rounded-xl border-[1.5px] border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-accent hover:border-brand dark:border-zinc-700 dark:bg-zinc-950"
          >
            Fallo arrivare a…
          </Link>
          <Link
            href={`/dossiers/${dossierId}/edit`}
            className="rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-hover"
          >
            Modifica
          </Link>
          {/* Le azioni che si fanno di rado, e quella che non si disfa, stanno in un menu: in testa restano tre pulsanti. */}
          <RowActionsMenu label="Altre azioni">
            <RowMenuItem disabled={busy} onClick={handleToggleStatus}>
              {isClosed ? "Riapri fascicolo" : "Chiudi fascicolo"}
            </RowMenuItem>
            <RowMenuItem disabled={busy} danger onClick={handleDelete}>
              Elimina
            </RowMenuItem>
          </RowActionsMenu>
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

      {/* Da telefono le schede stanno in quest'ordine: riepilogo, cosa fare (documenti attesi, prossimi passi, scadenze), poi la cronologia e
          il resto. Da lg in su: a sinistra ciò che si legge (riepilogo, cronologia, spese, persone, sintesi), a destra ciò che si fa. */}
      <div className="flex flex-col items-stretch gap-5 lg:flex-row lg:items-start">
        <div className="contents lg:flex lg:min-w-0 lg:flex-1 lg:flex-col lg:gap-5">
          {showSummary ? (
            <div className="order-1">
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
            </div>
          ) : null}
          <div className="order-3 flex min-w-0 flex-col gap-5">
            <DossierTimeline
              timeline={timeline}
              noteText={noteText}
              noteBusy={noteBusy}
              onNoteChange={setNoteText}
              onAddNote={() => void handleAddNote()}
            />
            {overview.expenses || showInvolved ? (
              <div className="grid items-start gap-5 md:grid-cols-2">
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
              </div>
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

        <div className="order-2 flex w-full shrink-0 flex-col gap-4 lg:w-[300px]">
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

        </div>
      </div>
    </div>
  );
}
