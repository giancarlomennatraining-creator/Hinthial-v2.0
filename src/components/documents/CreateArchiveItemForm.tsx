"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircleIcon } from "@/components/icons/nav-icons";
import { EMPTY_METADATA_FIELDS, type DocumentMetadataFieldsValue } from "@/components/documents/DocumentMetadataFields";
import { BackLink } from "@/components/ui/BackLink";
import { ErrorText } from "@/components/ui/ErrorText";
import { LoadingText } from "@/components/ui/LoadingText";
import { AccordionCard, AccordionStep, type StepState } from "@/components/documents/create/accordion";
import { DetailsStep } from "@/components/documents/create/DetailsStep";
import { FormFooter } from "@/components/documents/create/FormFooter";
import { ModeStep } from "@/components/documents/create/ModeStep";
import { NoteContent } from "@/components/documents/create/NoteContent";
import { PostSaveSteps } from "@/components/documents/create/PostSaveSteps";
import { RecordContent } from "@/components/documents/create/RecordContent";
import { UploadContent } from "@/components/documents/create/UploadContent";
import { MODE_ICON, MODE_LABEL, type CreationMode } from "@/components/documents/create/create-model";
import { useCreateFormData } from "@/components/documents/create/useCreateFormData";
import { useCreateSubmit, type GroupChoices } from "@/components/documents/create/useCreateSubmit";
import { useFileLot } from "@/components/documents/create/useFileLot";
import { usePostSave } from "@/components/documents/create/usePostSave";
import { BTN_SECONDARY } from "@/components/ui/styles";

/**
 * Pagina di creazione di un elemento d'Archivio --- un unico form per i tre modi (file, registrazione, nota), a
 * tappe (v. Artifact "Concept C" discusso con l'utente): un passo alla volta, gli altri si riducono a un riepilogo.
 * Dopo il salvataggio, i passi di cosa succede dopo (v. "Concept D"), invece del ritorno diretto all'archivio.
 *
 * Qui solo la composizione: i dati, il lotto di file, il salvataggio e i passi di dopo vivono ciascuno nel proprio hook
 * (cartella `create/`), i contenuti dei passi nei propri componenti.
 */
export function CreateArchiveItemForm({ masterKey }: { masterKey: CryptoKey }) {
  const searchParams = useSearchParams();

  const { categories, assets, dossiers, loading, error, setError } = useCreateFormData(masterKey);

  // Quale passo è aperto --- gli altri restano come riepilogo, mai tutti insieme. 1-3 prima del salvataggio, 4-5
  // dopo (lettura sul dispositivo, analisi con Silva). Parte dal passo 1: il primo input deve essere davvero la
  // prima scelta dell'utente, non una modalità già decisa per lui.
  const [activeStep, setActiveStep] = useState<1 | 2 | 3 | 4 | 5>(1);

  const [mode, setMode] = useState<CreationMode | null>(null);
  const [metadata, setMetadata] = useState<DocumentMetadataFieldsValue>(
    EMPTY_METADATA_FIELDS,
  );
  /** Il titolo del contenuto quando è uno solo (un file, o la registrazione); con più file ognuno ha il suo, nel lotto. */
  const [title, setTitle] = useState("");
  const [recordedFile, setRecordedFile] = useState<File | null>(null);
  const [noteTitle, setNoteTitle] = useState("");
  const [noteBody, setNoteBody] = useState("");
  // Per gruppo (per nome): se collegarlo, e con che titolo se nuovo. Le proposte partono selezionate: sono raggruppamenti evidenti.
  const [groupChoices, setGroupChoices] = useState<GroupChoices>({});

  const fileLot = useFileLot(masterKey, dossiers, title, setTitle, setError);
  const { lot, proposedGroups, readProgress } = fileLot;
  const postSave = usePostSave(masterKey, categories, setError);
  const { savedDoc } = postSave;
  const { creating, phase, batchProgress, handleCreate } = useCreateSubmit(masterKey, {
    mode,
    metadata,
    fileLot,
    title,
    recordedFile,
    noteTitle,
    noteBody,
    groupChoices,
    alreadySaved: savedDoc !== null,
    setError,
    onSaved: (created) => {
      postSave.markSaved(created);
      setActiveStep(4);
    },
  });

  // "?mode=" (v. DocumentsPanel.tsx, menu "+ Aggiungi contenuto"): apre già sul passo 2 nella modalità
  // scelta dal menu, invece di richiederla di nuovo qui. Un ref, non solo un check su `mode`, perché "upload"
  // è anche il primo valore che l'utente può scegliere da sé al passo 1 --- non deve essere ri-applicato a ogni render.
  const appliedInitialModeRef = useRef(false);
  useEffect(() => {
    if (appliedInitialModeRef.current) return;
    appliedInitialModeRef.current = true;
    const requested = searchParams.get("mode");
    if (
      requested !== "upload" &&
      requested !== "record" &&
      requested !== "note"
    )
      return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMode(requested);
    setActiveStep(2);
  }, [searchParams]);

  function handleModeChange(next: CreationMode) {
    setMode(next);
    fileLot.resetLot();
    setRecordedFile(null);
    setError(null);
    setTitle("");
    setMetadata(EMPTY_METADATA_FIELDS);
  }

  // Il file in gioco, qualunque sia il modo --- serve a parlare del contenuto giusto ("l'immagine", non "il documento").
  const isImage =
    mode === "record"
      ? (recordedFile?.type.startsWith("image/") ?? false)
      : lot.some((l) => l.file.type.startsWith("image/"));

  function readingLabel(): string {
    const what = lot.length > 1 ? "i file" : isImage ? "l'immagine" : "il documento";
    const percent =
      readProgress === null ? "" : ` ${Math.round(readProgress * 100)}%`;
    return `Sto leggendo ${what}…${percent}`;
  }

  const canSubmit = Boolean(
    (mode === "upload" && lot.length > 0) ||
      (mode === "record" && recordedFile) ||
      (mode === "note" && noteTitle.trim()),
  );

  const submitLabel = creating
    ? lot.length > 1 && batchProgress
      ? `Salvo ${Math.min(batchProgress.done + 1, batchProgress.total)} di ${batchProgress.total}…`
      : phase === "reading"
        ? readingLabel()
        : "Salvataggio…"
    : lot.length > 1
      ? `Aggiungi ${lot.length} file all'archivio`
      : "Aggiungi all'archivio";

  const step2Summary =
    mode === "upload"
      ? lot.length > 1
        ? `${lot.length} file`
        : (lot[0]?.file.name ?? "Nessun file scelto")
      : mode === "record"
        ? recordedFile
          ? "Registrazione pronta"
          : "Nessuna registrazione"
        : mode === "note"
          ? noteTitle || "Nota senza titolo"
          : "";

  const step3Category = categories.find((c) => c.id === metadata.categoryId);
  // Un fascicolo proposto si vede anche a passo chiuso: nasce solo se resta selezionato, e non deve nascere a insaputa di nessuno.
  const step3Proposals =
    mode === "upload"
      ? proposedGroups
          .filter((g) => groupChoices[g.label as string]?.link !== false)
          .map((g) => `fascicolo «${g.existingDossier?.title ?? (groupChoices[g.label as string]?.title.trim() || g.proposedDossierTitle)}»`)
      : [];
  const step3Summary =
    [step3Category ? `${step3Category.icon} ${step3Category.name}` : null, ...step3Proposals].filter(Boolean).join(" · ") ||
    "Nessun dettaglio aggiunto";

  const stepState = (step: number): StepState =>
    activeStep === step ? "active" : activeStep > step ? "done" : "todo";
  // Prima del salvataggio ogni passo non aperto è "fatto" (si può tornare a modificarlo); dopo, contano solo 4 e 5.
  const preSaveState = (step: number): StepState =>
    activeStep === step ? "active" : "done";

  return (
    <div className="flex flex-col gap-6">
      {savedDoc ? (
        <div className="flex flex-col gap-2">
          <span className="flex items-center gap-1.5 text-sm font-semibold text-emerald-600 dark:text-emerald-400">
            <CheckCircleIcon width={16} height={16} /> Documento salvato
          </span>
          <h1 className="text-2xl font-semibold tracking-tight text-title">
            {savedDoc.filename}
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            È già nel tuo Archivio, cifrato sul tuo dispositivo prima ancora di
            essere inviato.
          </p>
        </div>
      ) : (
        <div>
          <BackLink href="/archive">Torna all&apos;archivio</BackLink>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-title">
            Nuovo contenuto
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Documenti, immagini, audio, video o una nota scritta al momento —
            tutto cifrato sul tuo dispositivo prima di essere salvato.
          </p>
        </div>
      )}

      {loading ? (
        <LoadingText />
      ) : (
        <form onSubmit={handleCreate} className="flex flex-col gap-4">
          <AccordionCard>
            <AccordionStep
              step={1}
              state={preSaveState(1)}
              locked={savedDoc !== null}
              last={!mode}
              title="Cosa vuoi aggiungere?"
              summary={
                mode ? (
                  <>
                    {MODE_ICON[mode]} {MODE_LABEL[mode]}
                  </>
                ) : null
              }
              onOpen={() => setActiveStep(1)}
            >
              <ModeStep
                mode={mode}
                onSelect={(option) => {
                  handleModeChange(option);
                  setActiveStep(2);
                }}
              />
            </AccordionStep>

            {mode ? (
              <>
                <AccordionStep
                  step={2}
                  state={preSaveState(2)}
                  locked={savedDoc !== null}
                  title="Aggiungi il contenuto"
                  summary={step2Summary}
                  onOpen={() => setActiveStep(2)}
                >
                  {mode === "upload" ? (
                    <UploadContent
                      fileLot={fileLot}
                      title={title}
                      onTitleChange={setTitle}
                      isImage={isImage}
                      creating={creating}
                    />
                  ) : mode === "record" ? (
                    <RecordContent
                      recordedFile={recordedFile}
                      onRecorded={setRecordedFile}
                      title={title}
                      onTitleChange={setTitle}
                    />
                  ) : (
                    <NoteContent
                      noteTitle={noteTitle}
                      onNoteTitleChange={setNoteTitle}
                      noteBody={noteBody}
                      onNoteBodyChange={setNoteBody}
                    />
                  )}

                  <button
                    type="button"
                    disabled={!canSubmit}
                    onClick={() => setActiveStep(3)}
                    className={`${BTN_SECONDARY} w-full disabled:opacity-50 sm:w-fit`}
                  >
                    Continua →
                  </button>
                </AccordionStep>

                <AccordionStep
                  step={3}
                  state={preSaveState(3)}
                  locked={savedDoc !== null}
                  last={savedDoc === null}
                  title="Dettagli"
                  summary={step3Summary}
                  onOpen={() => setActiveStep(3)}
                >
                  <DetailsStep
                    isUpload={mode === "upload"}
                    fileCount={lot.length}
                    categories={categories}
                    assets={assets}
                    dossiers={dossiers}
                    metadata={metadata}
                    onMetadataChange={setMetadata}
                    proposedGroups={proposedGroups}
                    groupChoices={groupChoices}
                    onGroupChoicesChange={setGroupChoices}
                  />
                </AccordionStep>

                {savedDoc ? (
                  <PostSaveSteps
                    savedDoc={savedDoc}
                    postSave={postSave}
                    activeStep={activeStep}
                    setActiveStep={setActiveStep}
                    stepState={stepState}
                  />
                ) : null}
              </>
            ) : null}
          </AccordionCard>

          {error ? (
            <ErrorText>
              {error}
            </ErrorText>
          ) : null}

          <FormFooter
            savedDocId={savedDoc?.id ?? null}
            creating={creating}
            canSubmit={canSubmit}
            submitLabel={submitLabel}
          />
        </form>
      )}
    </div>
  );
}
