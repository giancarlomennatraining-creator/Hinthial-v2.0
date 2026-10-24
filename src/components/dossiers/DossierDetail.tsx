"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSupabase } from "@/lib/db/supabase/use-supabase";
import {
  addDossierPerson,
  addDossierStep,
  addExpectedItem,
  deleteDossierItem,
  deleteExpectedItem,
  setDossierPhases,
  setDossierStepDone,
  setExpectedItemDone,
} from "@/domain/dossiers/repository";
import { matchExpected } from "@/domain/dossiers/expected";
import { normalizePhases } from "@/domain/dossiers/phases";
import { buildLivingTimeline, dossierOverview } from "@/domain/dossiers/overview";
import { readableDocumentCount } from "@/domain/ai/dossier-summary";
import { useAIProcessingConsent } from "@/components/ai/AIProcessingConsentProvider";
import { DossierSummaryCard } from "@/components/dossiers/DossierSummaryCard";
import { useToast } from "@/components/ui/ToastProvider";
import { DossierTimeline } from "@/components/dossiers/DossierTimeline";
import { ExpectedItemsCard } from "@/components/dossiers/ExpectedItemsCard";
import { DossierNextSteps } from "@/components/dossiers/DossierNextSteps";
import { DossierInvolved } from "@/components/dossiers/DossierInvolved";
import { PhasesBar, PhasesEditor } from "@/components/dossiers/PhasesBar";
import { CandidatesCard, DeadlinesCard, ExpensesCard, ReadingsCard } from "@/components/dossiers/DossierSideCards";
import { DossierHeader } from "@/components/dossiers/detail/DossierHeader";
import { useDossierActions } from "@/components/dossiers/detail/useDossierActions";
import { useDossierData } from "@/components/dossiers/detail/useDossierData";
import { useDossierItemsAction } from "@/components/dossiers/detail/useDossierItemsAction";
import { useDossierSuggestions } from "@/components/dossiers/detail/useDossierSuggestions";
import { useDossierSummary } from "@/components/dossiers/detail/useDossierSummary";
import { GHOST_BUTTON } from "@/components/dossiers/styles";
import { BackLink } from "@/components/ui/BackLink";
import { ErrorText } from "@/components/ui/ErrorText";
import { LoadingText } from "@/components/ui/LoadingText";

/**
 * La scheda di un fascicolo: titolo, descrizione, stato, e la vicenda che racconta, in gran parte ricavata dai suoi
 * documenti: la cronologia (documenti, note e scadenze in un'unica linea), le prossime scadenze, le spese lette dai
 * documenti, i beni coinvolti. Il resto lo scrive l'utente, ed è tutto facoltativo: le fasi, i documenti attesi, i
 * prossimi passi, le persone. Una sezione senza dati non compare. Chi collega un documento al fascicolo lo fa dal form
 * del documento; le note nascono qui, come note dell'Archivio collegate al fascicolo.
 *
 * Qui solo la composizione: i dati, le azioni, le modifiche alle voci, i suggerimenti e il riassunto vivono ciascuno
 * nel proprio hook (cartella `detail/`).
 */
export function DossierDetail({ masterKey, dossierId }: { masterKey: CryptoKey; dossierId: string }) {
  const supabase = useSupabase();
  const router = useRouter();
  const searchParams = useSearchParams();
  const showToast = useToast();
  const { masterEnabled, extractionConsent } = useAIProcessingConsent();

  const data = useDossierData(masterKey, dossierId);
  const { dossier, setDossier, documents, assets, reminders, now, loading, error, expectedItems, setExpectedItems, items, setItems } = data;
  const actions = useDossierActions(masterKey, dossierId, data);
  const { itemsBusy, runItemsAction } = useDossierItemsAction(data);
  const suggestions = useDossierSuggestions(dossierId, data);
  const summary = useDossierSummary(masterKey, dossierId, data);

  const [adding, setAdding] = useState({ expected: false, steps: false, people: false });
  const [editingPhases, setEditingPhases] = useState(false);

  // "?created=1"/"?updated=1" --- stesso schema di CapsulesPanel.tsx.
  const [showCreatedMessage] = useState(() => searchParams.get("created") === "1");
  const [showUpdatedMessage] = useState(() => searchParams.get("updated") === "1");
  useEffect(() => {
    if (showCreatedMessage) showToast("Fascicolo creato.");
    if (showUpdatedMessage) showToast("Fascicolo aggiornato.");
    if (showCreatedMessage || showUpdatedMessage) router.replace(`/dossiers/${dossierId}`);
  }, [showCreatedMessage, showUpdatedMessage, router, showToast, dossierId]);

  if (loading) {
    return <LoadingText />;
  }

  if (!dossier) {
    return (
      <div className="flex flex-col gap-4">
        <BackLink href="/dossiers">Torna ai fascicoli</BackLink>
        <ErrorText>
          Fascicolo non trovato.
        </ErrorText>
      </div>
    );
  }

  const isClosed = dossier.status === "closed";
  const linkedDocuments = documents.filter((doc) => doc.dossierIds.includes(dossierId));
  const overview = dossierOverview({ documents: linkedDocuments, reminders, assets, steps: items?.steps, now });
  const timeline = buildLivingTimeline(linkedDocuments, reminders);
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
      <DossierHeader
        dossier={dossier}
        overview={overview}
        now={now}
        busy={actions.busy}
        onToggleStatus={actions.handleToggleStatus}
        onDelete={actions.handleDelete}
      />

      {error ? (
        <ErrorText>
          {error}
        </ErrorText>
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
                busy={summary.summaryBusy}
                notice={summary.summaryNotice}
                now={now}
                onWrite={() => void summary.handleWriteSummary()}
                onRemove={() => void summary.handleRemoveSummary()}
              />
            </div>
          ) : null}
          <div className="order-3 flex min-w-0 flex-col gap-5">
            <DossierTimeline
              timeline={timeline}
              noteText={actions.noteText}
              noteBusy={actions.noteBusy}
              onNoteChange={actions.setNoteText}
              onAddNote={() => void actions.handleAddNote()}
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
                readings={summary.readings}
                busy={summary.readingsBusy}
                onShow={() => void summary.handleShowReadings(linkedDocuments.map((d) => d.id))}
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

          {suggestions.candidates.length > 0 ? (
            <CandidatesCard
              candidates={suggestions.candidates}
              busy={suggestions.suggestionBusy}
              onAdd={(documentId) => void suggestions.handleAddCandidate(documentId)}
              onDismiss={suggestions.handleDismissCandidate}
            />
          ) : null}

          {overview.deadlines.length > 0 ? <DeadlinesCard deadlines={overview.deadlines} /> : null}

        </div>
      </div>
    </div>
  );
}
