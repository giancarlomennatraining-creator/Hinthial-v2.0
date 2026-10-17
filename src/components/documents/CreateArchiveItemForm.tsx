"use client";

import { mimeTypeOfFile } from "@/lib/file-mime";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useSupabase } from "@/lib/db/supabase/use-supabase";
import {
  createTextNote,
  getDocumentById,
  listDocumentSummaries,
  saveAISynthesis,
  saveContentAnalysis,
  updateDocumentAIExtractionExclusion,
  uploadDocument,
  type PriorExtraction,
  type UploadPhase,
} from "@/domain/documents/repository";
import { listAssets } from "@/domain/assets/repository";
import {
  listCategories,
  grantCategoryAIExtractionTemporarily,
} from "@/domain/categories/repository";
import { isCategoryEnabledForExtraction } from "@/domain/categories/ai-consent";
import { createDossier, listDossiers } from "@/domain/dossiers/repository";
import type { DossierListItem } from "@/domain/dossiers/types";
import { canExtractText, extractContent } from "@/domain/extraction/extract-text";
import type { ContentSegment } from "@/domain/extraction/types";
import { loadDocumentSegments } from "@/domain/documents/segments";
import { useDocumentSegments } from "@/components/documents/useDocumentSegments";
import { readingStateFor } from "@/domain/extraction/reading-state";
import { FileDropZone } from "@/components/documents/FileDropZone";
import { detectDuplicates } from "@/domain/bulk-import/duplicates";
import { groupByFilename } from "@/domain/bulk-import/grouping";
import { useToast } from "@/components/ui/ToastProvider";
import { addPendingConfirmation } from "@/domain/documents/pending-confirmation";
import {
  AnalysisAbortedError,
  analysisConfirmMessage,
  analyzeDocumentWithClaude,
  inspectSavedAnalysis,
  planAnalysis,
  type AIAnalysisScope,
  type AnalysisProgress,
  type SavedAnalysisState,
} from "@/domain/ai/analyze-document";
import { useAIProcessingConsent } from "@/components/ai/AIProcessingConsentProvider";
import { AIAnalysisTrigger } from "@/components/documents/AIAnalysisTrigger";
import { CheckCircleIcon } from "@/components/icons/nav-icons";
import { formatDate, formatSize } from "@/lib/format";
import { AudioVideoRecorder } from "@/components/media/AudioVideoRecorder";
import {
  DocumentMetadataFields,
  EMPTY_METADATA_FIELDS,
  type DocumentMetadataFieldsValue,
} from "@/components/documents/DocumentMetadataFields";
import type { Category } from "@/domain/categories/types";
import type { AssetListItem } from "@/domain/assets/types";
import type {
  DocumentListItem,
  DocumentMetadataInput,
  DocumentSummary,
} from "@/domain/documents/types";
import { BTN_PRIMARY, BTN_SECONDARY, INPUT_FIELD } from "@/components/ui/styles";

type CreationMode = "upload" | "record" | "note";

/** FASE 19b: stato della lettura --- "skipped" (tipo non leggibile) è diverso da "done" senza risultato. */
type ReadingState =
  | { status: "idle" }
  | { status: "reading"; progress: number | null }
  | { status: "skipped" }
  | { status: "done"; text: string | null };

/**
 * Un file scelto. Uno o molti, il percorso è lo stesso: ognuno ha il suo stato di lettura e, se i file sono più d'uno, il
 * suo titolo.
 */
interface LotFile {
  id: string;
  file: File;
  title: string;
  reading: ReadingState;
}

const MODE_LABEL: Record<CreationMode, string> = {
  upload: "Carica un file",
  record: "Registra audio/video",
  note: "Scrivi una nota",
};

const MODE_ICON: Record<CreationMode, string> = {
  upload: "📄",
  record: "🎬",
  note: "📝",
};

const MODE_DESCRIPTION: Record<CreationMode, string> = {
  upload: "uno o più file: bollette, contratti, referti",
  record: "audio o video",
  note: "testo scritto ora",
};

type StepState = "active" | "done" | "todo";

/** Il segno di spunta del passo completato --- il tratto si disegna (v. .step-check-path in globals.css). */
function StepCheck() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      aria-hidden="true"
    >
      <path
        className="step-check-path"
        d="M5 12.5l4.5 4.5L19 7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** La scheda unica che contiene tutti i passi: le linee tra i cerchi la attraversano da un passo al successivo. */
function AccordionCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-[0_8px_20px_rgba(16,24,40,0.04)] dark:border-zinc-800 dark:bg-zinc-950">
      {children}
    </div>
  );
}

/**
 * Il momento "salvato" tra i Dettagli e i passi di Hinthial: si apre, mostra il cerchio verde con l'anello che si
 * espande, poi si ripiega (`open` torna false) lasciando il posto al passo successivo.
 */
function SavedMoment({ open }: { open: boolean }) {
  return (
    <div className="step-body" data-open={open ? "true" : "false"}>
      <div className="step-inner" inert={!open}>
        <div
          role="status"
          className="flex items-center gap-3 px-5 py-3.5 text-sm font-semibold text-emerald-600 dark:text-emerald-400"
        >
          <span className="saved-pop relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white">
            <span
              aria-hidden="true"
              className="saved-ring absolute inset-0 rounded-full border-2 border-emerald-500"
            />
            <StepCheck />
          </span>
          Salvato e cifrato sul tuo dispositivo
        </div>
      </div>
    </div>
  );
}

/**
 * Concept A "Fisarmonica fluida" (v. Artifact discusso con l'utente): un passo alla volta, il completato si riduce
 * a un riepilogo con "Modifica" e il cerchio diventa una spunta verde, il successivo si apre in modo fluido.
 * `locked`: il passo è già stato salvato, si vede ma non si riapre. `separator`: una riga di testo prima del passo.
 */
function AccordionStep({
  step,
  state,
  locked = false,
  last = false,
  title,
  summary,
  separator,
  onOpen,
  children,
}: {
  step: number;
  state: StepState;
  locked?: boolean;
  last?: boolean;
  title: string;
  summary?: React.ReactNode;
  separator?: string;
  onOpen: () => void;
  children: React.ReactNode;
}) {
  const active = state === "active";
  // Il contenuto resta montato per la durata della chiusura, altrimenti sparirebbe di colpo invece di ripiegarsi.
  const [mounted, setMounted] = useState(active);
  if (active && !mounted) setMounted(true);
  useEffect(() => {
    if (active) return;
    const id = setTimeout(() => setMounted(false), 650);
    return () => clearTimeout(id);
  }, [active]);

  return (
    <>
      {separator ? (
        <div className="mx-5 my-2 flex items-center gap-3 text-xs font-medium text-zinc-500 sm:ml-[3.75rem] dark:text-zinc-400">
          <span className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
          <span>{separator}</span>
          <span className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
        </div>
      ) : null}
      <div className="relative">
        {last ? null : (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute top-[46px] -bottom-3 left-[33px] hidden w-0.5 rounded bg-zinc-200 sm:block dark:bg-zinc-800"
          >
            <span
              className="step-line-fill block h-full w-full bg-emerald-500"
              data-done={state === "done" ? "true" : "false"}
            />
          </span>
        )}
        <button
          type="button"
          onClick={onOpen}
          disabled={locked}
          aria-expanded={active}
          className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left disabled:cursor-default"
        >
          <span className="flex min-w-0 items-center gap-3">
            <span
              className={
                state === "active"
                  ? "flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand text-sm font-bold text-white"
                  : state === "done"
                    ? "flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white"
                    : "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-zinc-300 text-sm font-bold text-zinc-400 dark:border-zinc-700 dark:text-zinc-500"
              }
            >
              {state === "done" ? <StepCheck /> : step}
            </span>
            <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              {title}
            </span>
          </span>
          {active || !summary ? null : (
            <span className="flex min-w-0 items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
              <span className="truncate">{summary}</span>
              {locked || state === "todo" ? null : (
                <span className="shrink-0 font-semibold text-accent">
                  Modifica
                </span>
              )}
            </span>
          )}
        </button>
        <div className="step-body" data-open={active ? "true" : "false"}>
          <div className="step-inner" inert={!active}>
            {mounted ? (
              // pt-1.5: .step-inner nasconde ciò che esce dai bordi (serve all'animazione di apertura), e senza un margine in
              // alto il contorno di "elemento attivo" del primo campo (es. il riquadro di caricamento) veniva tagliato.
              <div className="flex flex-col gap-4 px-5 pt-1.5 pb-5 sm:pl-[3.75rem]">
                {children}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </>
  );
}

/** Il titolo scelto per una registrazione, con l'estensione del file: senza, il sistema operativo non saprebbe più con cosa aprirlo. */
function recordingTitle(title: string, filename: string): string | undefined {
  const trimmed = title.trim();
  if (!trimmed) return undefined;
  const extension = filename.includes(".")
    ? filename.slice(filename.lastIndexOf("."))
    : "";
  return trimmed.toLowerCase().endsWith(extension.toLowerCase())
    ? trimmed
    : `${trimmed}${extension}`;
}

/** Segno accanto al file scelto --- sostituisce il vecchio blocco "Ho letto il documento": un segno, non un riquadro a sé. */
function FileReadingStatus({ reading }: { reading: ReadingState }) {
  if (reading.status === "reading") {
    return (
      <span className="text-xs whitespace-nowrap text-zinc-500 dark:text-zinc-400">
        Lettura…
        {reading.progress === null
          ? ""
          : ` ${Math.round(reading.progress * 100)}%`}
      </span>
    );
  }
  if (reading.status === "skipped") {
    return (
      <span className="text-xs whitespace-nowrap text-zinc-500 dark:text-zinc-400">
        Non so ancora leggerlo
      </span>
    );
  }
  if (reading.status === "done") {
    return reading.text ? (
      <span className="flex items-center gap-1 text-xs font-medium whitespace-nowrap text-emerald-600 dark:text-emerald-400">
        <CheckCircleIcon width={14} height={14} /> Letto sul dispositivo
      </span>
    ) : (
      <span className="text-xs whitespace-nowrap text-zinc-500 dark:text-zinc-400">
        Nessun testo trovato
      </span>
    );
  }
  return null;
}

/**
 * Pagina di creazione di un elemento d'Archivio --- un unico form per i tre modi (file, registrazione, nota), a
 * tappe (v. Artifact "Concept C" discusso con l'utente): un passo alla volta, gli altri si riducono a un riepilogo.
 * Dopo il salvataggio, i passi di cosa succede dopo (v. "Concept D"), invece del ritorno diretto all'archivio.
 */
export function CreateArchiveItemForm({ masterKey }: { masterKey: CryptoKey }) {
  const supabase = useSupabase();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { masterEnabled, extractionConsent } = useAIProcessingConsent();
  const showToast = useToast();

  const [categories, setCategories] = useState<Category[]>([]);
  const [assets, setAssets] = useState<AssetListItem[]>([]);
  const [dossiers, setDossiers] = useState<DossierListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  // FASE 17b/17c: dice "sto leggendo" invece di "Salvataggio…" mentre legge; la percentuale distingue un'attesa lunga da un blocco.
  const [phase, setPhase] = useState<UploadPhase>("saving");
  const [readProgress, setReadProgress] = useState<number | null>(null);

  // Quale passo è aperto --- gli altri restano come riepilogo, mai tutti insieme. 1-3 prima del salvataggio, 4-5
  // dopo (lettura sul dispositivo, analisi con Hinthia). Parte dal passo 1: il primo input deve essere davvero la
  // prima scelta dell'utente, non una modalità già decisa per lui.
  const [activeStep, setActiveStep] = useState<1 | 2 | 3 | 4 | 5>(1);

  const [mode, setMode] = useState<CreationMode | null>(null);
  const [metadata, setMetadata] = useState<DocumentMetadataFieldsValue>(
    EMPTY_METADATA_FIELDS,
  );
  const fileInputRef = useRef<HTMLInputElement>(null);
  // I file scelti: uno o molti, stesso percorso (v. addFiles). Ognuno si legge sul dispositivo appena scelto.
  const [lot, setLot] = useState<LotFile[]>([]);

  // FASE 19b: la lettura parte appena scegli i file, non a Salva --- avviene dentro il tempo che stavi già spendendo. Uno
  // alla volta, non in parallelo: dieci file insieme su un telefono, alcuni con OCR, lo farebbero solo arrancare.
  const readQueueRef = useRef<Promise<unknown>>(Promise.resolve());
  // La lettura di ogni file, per poterla aspettare al salvataggio se non ha ancora finito (v. uploadLot).
  const readPromisesRef = useRef(new Map<string, Promise<PriorExtraction>>());
  // La zona resta visibile mentre i file si leggono e un istante dopo (il timbro "Fatto"), poi lascia il posto alla scheda dei file.
  const [zoneSettled, setZoneSettled] = useState(false);
  const lotReading = lot.some((l) => l.reading.status === "idle" || l.reading.status === "reading");
  const zoneState = lot.length === 0 ? "idle" : lotReading ? "loading" : "done";
  const zoneProgress = (() => {
    const current = lot.find((l) => l.reading.status === "reading");
    const currentProgress = current && current.reading.status === "reading" ? current.reading.progress : null;
    if (lot.length === 1) return currentProgress;
    const finished = lot.filter((l) => l.reading.status === "done" || l.reading.status === "skipped").length;
    return lotReading ? (finished + (currentProgress ?? 0)) / lot.length : null;
  })();
  useEffect(() => {
    if (lot.length === 0 || zoneState !== "done" || zoneSettled) return;
    const timer = setTimeout(() => setZoneSettled(true), 1100);
    return () => clearTimeout(timer);
  }, [lot.length, zoneState, zoneSettled]);
  /** Il titolo del contenuto quando è uno solo (un file, o la registrazione); con più file ognuno ha il suo, in `lot`. */
  const [title, setTitle] = useState("");
  const [recordedFile, setRecordedFile] = useState<File | null>(null);
  const [noteTitle, setNoteTitle] = useState("");
  const [noteBody, setNoteBody] = useState("");

  // Cosa c'è già in Archivio, per riconoscere i doppioni e i fascicoli a cui un file sembra appartenere. Si legge una volta,
  // alla prima scelta di un file: partire senza file non deve costare nulla.
  const [existingDocuments, setExistingDocuments] = useState<Pick<DocumentSummary, "filename" | "size" | "createdAt" | "dossierIds">[]>([]);
  const existingRequestedRef = useRef(false);
  useEffect(() => {
    if (lot.length === 0 || existingRequestedRef.current) return;
    existingRequestedRef.current = true;
    listDocumentSummaries(supabase, masterKey)
      .then(setExistingDocuments)
      .catch(() => {
        // Senza, il file si carica lo stesso: solo non si avvisa dei doppioni.
      });
  }, [lot.length, supabase, masterKey]);
  const duplicates = useMemo(() => detectDuplicates(lot, existingDocuments), [lot, existingDocuments]);
  const groups = useMemo(() => groupByFilename(lot, existingDocuments, dossiers), [lot, existingDocuments, dossiers]);
  // Le proposte di fascicolo: i gruppi con un fascicolo esistente o uno nuovo da creare (v. domain/bulk-import/grouping.ts).
  const proposedGroups = groups.filter((g) => g.label !== null && (g.existingDossier || g.proposedDossierTitle));
  // Per gruppo (per nome): se collegarlo, e con che titolo se nuovo. Le proposte partono selezionate: sono raggruppamenti evidenti.
  const [groupChoices, setGroupChoices] = useState<Record<string, { link: boolean; title: string }>>({});
  const [batchProgress, setBatchProgress] = useState<{ done: number; total: number } | null>(null);

  // Concept D: dopo il salvataggio, il documento appena creato e i passi su cosa farne --- invece del ritorno
  // diretto all'archivio. `null` = form ancora in corso.
  const [savedDoc, setSavedDoc] = useState<DocumentListItem | null>(null);
  const [savedMoment, setSavedMoment] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiProgress, setAiProgress] = useState<AnalysisProgress | null>(null);
  const [aiDone, setAiDone] = useState(false);
  const aiAbortRef = useRef<AbortController | null>(null);
  const [savedAnalysis, setSavedAnalysis] = useState<SavedAnalysisState>({ kind: "none" });

  const savedAnalysisSource = savedDoc?.contentAnalysis ?? null;
  const savedAnalysisText = savedDoc?.extractedText ?? "";
  const { segments: pageSegments, ready: segmentsReady } = useDocumentSegments(supabase, masterKey, savedDoc);
  useEffect(() => {
    if (!segmentsReady) return;
    let cancelled = false;
    inspectSavedAnalysis({ extractedText: savedAnalysisText, contentAnalysis: savedAnalysisSource }, masterKey, {
      segments: pageSegments,
    })
      .then((state) => {
        if (!cancelled) setSavedAnalysis(state);
      })
      .catch(() => {
        if (!cancelled) setSavedAnalysis({ kind: "none" });
      });
    return () => {
      cancelled = true;
    };
  }, [savedAnalysisSource, savedAnalysisText, masterKey, pageSegments, segmentsReady]);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const [categoriesResult, assetsResult, dossiersResult] =
        await Promise.all([
          listCategories(supabase),
          listAssets(supabase, masterKey),
          listDossiers(supabase, masterKey),
        ]);
      setCategories(categoriesResult);
      setAssets(assetsResult);
      setDossiers(dossiersResult);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Impossibile caricare i dati necessari.",
      );
    } finally {
      setLoading(false);
    }
  }, [supabase, masterKey]);

  useEffect(() => {
    // See DocumentsPanel.tsx for why fetch-on-mount is legitimate here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
  }, [refresh]);

  // Il momento "salvato" dura un istante, poi si apre "Lettura dal dispositivo".
  useEffect(() => {
    if (!savedMoment) return;
    const id = setTimeout(() => setSavedMoment(false), 1800);
    return () => clearTimeout(id);
  }, [savedMoment]);

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
    setLot([]);
    readPromisesRef.current.clear();
    setZoneSettled(false);
    setRecordedFile(null);
    setError(null);
    setTitle("");
    setMetadata(EMPTY_METADATA_FIELDS);
  }

  function updateLotFile(id: string, patch: Partial<Pick<LotFile, "title" | "reading">>) {
    setLot((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }

  /** Aggiunge file al lotto (uno o molti) e ne avvia la lettura, dopo quelli già in coda. */
  function addFiles(files: File[]) {
    if (files.length === 0) return;
    setError(null);
    setZoneSettled(false);
    const added: LotFile[] = files.map((file) => ({
      id: crypto.randomUUID(),
      file,
      title: "",
      reading: { status: "idle" },
    }));
    // Passando da uno a più file il titolo scritto finora resta al primo, non si perde.
    setLot((prev) => {
      const next = prev.length === 1 && title ? prev.map((item) => ({ ...item, title })) : prev;
      return [...next, ...added];
    });
    if (lot.length === 1 && title) setTitle("");
    // Non si azzerano categoria/bene/fascicoli/note: ciò che è già compilato non si tocca.
    for (const item of added) {
      const promise = readQueueRef.current.then(() => readLotFile(item));
      readQueueRef.current = promise;
      readPromisesRef.current.set(item.id, promise);
    }
  }

  /** Toglie un file dal lotto (anche un doppione che non vale la pena riportare dentro). */
  function removeFile(id: string) {
    readPromisesRef.current.delete(id);
    const remaining = lot.filter((item) => item.id !== id);
    setLot(remaining);
    // Tornando a un file solo, il suo titolo torna nel campo unico.
    if (remaining.length === 1) setTitle(remaining[0].title);
    if (remaining.length <= 1) setZoneSettled(remaining.length === 1);
    if (remaining.length === 0) {
      setTitle("");
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  /** Legge il testo del file sul dispositivo, per salvarlo con il contenuto (ricerca, analisi di Hinthia). Non compila nessun campo. */
  async function readLotFile({ id, file }: LotFile): Promise<PriorExtraction> {
    const mimeType = mimeTypeOfFile(file);

    if (!canExtractText(mimeType)) {
      updateLotFile(id, { reading: { status: "skipped" } });
      return { text: null, attempted: false };
    }

    updateLotFile(id, { reading: { status: "reading", progress: null } });
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const content = await extractContent(bytes, mimeType, (progress) => {
        updateLotFile(id, { reading: { status: "reading", progress } });
        setReadProgress(progress);
      });
      const text = content?.text ?? null;
      updateLotFile(id, { reading: { status: "done", text } });
      return { text, segments: content?.segments, attempted: true };
    } catch {
      // Leggere è un di più: un file illeggibile non deve impedire di salvarlo.
      updateLotFile(id, { reading: { status: "done", text: null } });
      return { text: null, attempted: false };
    }
  }

  // "📷 Scatta foto" riusa la stessa casella file con `capture` impostato un istante prima (ignorato sui dispositivi che non lo supportano) --- un solo <input type="file"> nel DOM.
  function handleCameraClick() {
    const input = fileInputRef.current;
    if (!input) return;
    input.setAttribute("accept", "image/*");
    input.setAttribute("capture", "environment");
    input.click();
  }

  // Ripristina la casella al comportamento normale --- altrimenti un click diretto continuerebbe ad aprire solo la fotocamera.
  function handleFileInputBlur(event: React.FocusEvent<HTMLInputElement>) {
    event.target.removeAttribute("accept");
    event.target.removeAttribute("capture");
  }

  /**
   * Salva tutti i file del lotto, uno dopo l'altro, con gli stessi dettagli. Un fascicolo proposto (v. proposedGroups) si
   * crea una volta per gruppo, non per file: dieci bollette non devono finire in dieci fascicoli. Con un file solo un errore
   * si mostra e si ferma; con più file un file che non si riesce a salvare non ferma gli altri, si conta e si prosegue.
   */
  async function uploadLot(userId: string, metadataInput: DocumentMetadataInput) {
    const strict = lot.length === 1;
    const dossierByFile = new Map<string, string>();
    let dossiersCreated = 0;
    for (const group of proposedGroups) {
      const key = group.label as string;
      const choice = groupChoices[key];
      if (choice && !choice.link) continue;
      let dossierId = group.existingDossier?.id ?? null;
      if (!dossierId && group.proposedDossierTitle) {
        const dossierTitle = choice?.title.trim() || group.proposedDossierTitle;
        try {
          dossierId = await createDossier(supabase, masterKey, userId, { title: dossierTitle, description: "" });
          dossiersCreated++;
        } catch {
          dossierId = null; // il fascicolo non nasce, ma i file si salvano comunque.
        }
      }
      if (dossierId) for (const f of group.files) dossierByFile.set(f.id, dossierId);
    }

    const ids: string[] = [];
    let failures = 0;
    setBatchProgress({ done: 0, total: lot.length });
    for (const [index, item] of lot.entries()) {
      const groupDossier = dossierByFile.get(item.id);
      const input: DocumentMetadataInput = {
        ...metadataInput,
        dossierIds:
          groupDossier && !metadataInput.dossierIds.includes(groupDossier)
            ? [...metadataInput.dossierIds, groupDossier]
            : metadataInput.dossierIds,
      };
      try {
        // Se la lettura non ha ancora finito si aspetta (era già in corso dalla scelta del file), altrimenti il documento nascerebbe non cercabile.
        if (strict && item.reading.status === "reading") setPhase("reading");
        const extraction = (await readPromisesRef.current.get(item.id)) ?? { text: null, attempted: false };
        ids.push(
          await uploadDocument(supabase, masterKey, userId, item.file, input, {
            title: strict ? title : item.title || undefined,
            extraction,
            onPhase: strict
              ? (nextPhase, progress) => {
                  setPhase(nextPhase);
                  setReadProgress(progress);
                }
              : undefined,
          }),
        );
      } catch (err) {
        if (strict) throw err;
        failures++;
      }
      setBatchProgress({ done: index + 1, total: lot.length });
    }
    return { ids, failures, dossiersCreated };
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (savedDoc) return;
    setError(null);

    if (mode === "note" && !noteTitle.trim()) {
      setError("Inserisci un titolo per la nota.");
      return;
    }
    if (mode === "upload" && lot.length === 0) {
      setError("Scegli un file da caricare.");
      return;
    }
    if (mode === "record" && !recordedFile) {
      setError("Registra un audio o un video prima di continuare.");
      return;
    }

    setCreating(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Devi essere autenticato.");

      const metadataInput: DocumentMetadataInput = {
        categoryId: metadata.categoryId || null,
        relatedAssetId: metadata.relatedAssetId || null,
        dossierIds: metadata.dossierIds,
        expiresAt: metadata.expiresAt || null,
        notes: metadata.notes,
        issuer: metadata.issuer,
      };

      let newId: string;
      if (mode === "note") {
        newId = await createTextNote(
          supabase,
          masterKey,
          user.id,
          { title: noteTitle.trim(), body: noteBody },
          metadataInput,
        );
      } else if (mode === "upload") {
        const result = await uploadLot(user.id, metadataInput);
        if (result.ids.length === 0) throw new Error("Nessun file è stato importato.");
        // Uno o molti, dopo il salvataggio si va alla conferma (v. ConfirmImport): lettura di Hinthia, proposte, dettagli.
        showToast(
          lot.length === 1
            ? "Documento aggiunto."
            : result.failures === 0
              ? `${result.ids.length} contenuti importati${result.dossiersCreated > 0 ? `, ${result.dossiersCreated} nuovo fascicolo` : ""}.`
              : `${result.ids.length} importati, ${result.failures} non riusciti.`,
        );
        // Si ricordano da confermare su questo dispositivo, per riaprire la conferma da Archivio se la si chiude a metà.
        addPendingConfirmation(user.id, result.ids);
        router.push(`/archive/confirm?ids=${result.ids.join(",")}`);
        return;
      } else {
        const file = recordedFile!;
        newId = await uploadDocument(
          supabase,
          masterKey,
          user.id,
          file,
          metadataInput,
          {
            title: recordingTitle(title, file.name),
            // Il file registrato non passa dalla lettura del form: lo legge uploadDocument come sempre.
            onPhase: (nextPhase, progress) => {
              setPhase(nextPhase);
              setReadProgress(progress);
            },
          },
        );
      }

      // Invece del ritorno diretto a /archive, i passi 4 e 5 (cosa Hinthial ne ha già ricavato e, se vuoi,
      // l'analisi con Claude) --- prima di scegliere se andare sulla scheda o tornare all'archivio.
      const created = await getDocumentById(supabase, masterKey, newId);
      if (created) {
        setSavedDoc(created);
        setSavedMoment(true);
        setActiveStep(4);
      } else {
        // Non dovrebbe succedere, ma senza il documento non c'è niente da mostrare nei passi.
        router.push("/archive?created=1");
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Impossibile aggiungere il contenuto.",
      );
      setCreating(false);
    }
  }

  /** Stesso principio di ArchiveItemDetail.handleAnalyzeWithClaude --- qui basta la sintesi: le proposte si accettano sulla scheda, non qui. */
  async function handleAnalyzeWithClaude(scope: AIAnalysisScope, options?: { force?: boolean }) {
    if (!savedDoc) return;
    const force = options?.force === true;
    // Lettura salvata e pagine si rileggono qui, non dallo stato: v. ArchiveItemDetail.handleAnalyzeWithClaude.
    let segments: ContentSegment[] | null;
    let saved: SavedAnalysisState;
    try {
      segments = await loadDocumentSegments(supabase, masterKey, savedDoc).catch(() => null);
      saved = force ? { kind: "none" } : await inspectSavedAnalysis(savedDoc, masterKey, { segments });
    } catch {
      return;
    }
    if (saved.kind === "complete") return;
    if (
      !window.confirm(analysisConfirmMessage(planAnalysis(savedDoc, { segments }), saved))
    ) {
      return;
    }

    const abort = new AbortController();
    aiAbortRef.current = abort;
    setAiBusy(true);
    setError(null);
    try {
      if (scope === "temporary" && savedDoc.categoryId) {
        await grantCategoryAIExtractionTemporarily(
          supabase,
          savedDoc.categoryId,
          30,
        );
      }
      const fields = await analyzeDocumentWithClaude(
        savedDoc,
        categories,
        scope,
        {
          segments,
          onProgress: setAiProgress,
          signal: abort.signal,
          force,
          persistence: {
            masterKey,
            saved: savedDoc.contentAnalysis,
            save: (analysis, status) => saveContentAnalysis(supabase, masterKey, savedDoc.id, analysis, status),
          },
        },
      );
      if (fields.synthesis) {
        await saveAISynthesis(
          supabase,
          masterKey,
          savedDoc.id,
          fields.synthesis,
        );
      }
      setSavedDoc((await getDocumentById(supabase, masterKey, savedDoc.id)) ?? savedDoc);
      setAiDone(true);
    } catch (err) {
      // Ciò che era già stato letto è salvato: si rilegge il documento perché il bottone proponga di riprendere.
      const reloaded = await getDocumentById(supabase, masterKey, savedDoc.id).catch(() => null);
      if (reloaded) setSavedDoc(reloaded);
      if (!(err instanceof AnalysisAbortedError)) {
        setError(
          err instanceof Error
            ? err.message
            : "Impossibile analizzare il documento con Hinthia.",
        );
      }
    } finally {
      aiAbortRef.current = null;
      setAiBusy(false);
      setAiProgress(null);
    }
  }

  async function handleToggleAIExclusion(next: boolean) {
    if (!savedDoc) return;
    setError(null);
    try {
      await updateDocumentAIExtractionExclusion(supabase, savedDoc.id, next);
      setSavedDoc((await getDocumentById(supabase, masterKey, savedDoc.id)) ?? savedDoc);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Impossibile salvare l'esclusione.",
      );
    }
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

  const canSubmit =
    (mode === "upload" && lot.length > 0) ||
    (mode === "record" && recordedFile) ||
    (mode === "note" && noteTitle.trim());

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

  // --- Dopo il salvataggio: i passi 4 e 5 nella stessa fisarmonica.
  const aiCategory = savedDoc
    ? categories.find((c) => c.id === savedDoc.categoryId)
    : undefined;
  const categoryEnabledForAI = aiCategory
    ? isCategoryEnabledForExtraction(aiCategory)
    : false;
  const readingState = savedDoc ? readingStateFor(savedDoc) : null;
  const step4Summary = savedDoc
    ? readingState === "text"
      ? `${savedDoc.extractedText.length.toLocaleString("it-IT")} caratteri letti`
      : "Fatto"
    : "";
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
          <Link
            href="/archive"
            className="text-sm font-medium text-zinc-500 underline-offset-2 hover:underline dark:text-zinc-400"
          >
            ← Torna all&apos;archivio
          </Link>
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
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Caricamento…</p>
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
              <div
                role="radiogroup"
                aria-label="Tipo di contenuto"
                className="grid grid-cols-1 gap-3 sm:grid-cols-3"
              >
                {(Object.keys(MODE_LABEL) as CreationMode[]).map((option) => (
                  <button
                    key={option}
                    type="button"
                    role="radio"
                    aria-checked={mode === option}
                    onClick={() => {
                      handleModeChange(option);
                      setActiveStep(2);
                    }}
                    className={
                      mode === option
                        ? "flex flex-col items-center gap-1.5 rounded-2xl border-2 border-brand bg-brand/5 px-4 py-5 text-center"
                        : "flex flex-col items-center gap-1.5 rounded-2xl border border-zinc-200 px-4 py-5 text-center hover:border-zinc-300 dark:border-zinc-800 dark:hover:border-zinc-700"
                    }
                  >
                    <span className="text-2xl" aria-hidden="true">
                      {MODE_ICON[option]}
                    </span>
                    <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                      {MODE_LABEL[option]}
                    </span>
                    <span className="text-xs text-zinc-500 dark:text-zinc-400">
                      {MODE_DESCRIPTION[option]}
                    </span>
                  </button>
                ))}
              </div>
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
                    <div className="flex flex-col gap-3">
                      {lot.length > 0 && zoneSettled ? (
                        <div className="flex flex-col gap-2">
                          {lot.map((item, index) => {
                            const duplicate = duplicates[index];
                            return (
                              <div key={item.id} className="flex flex-col gap-1.5">
                                <div className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900">
                                  <span className="text-xl" aria-hidden="true">
                                    {item.file.type.startsWith("image/") ? "🖼️" : "📄"}
                                  </span>
                                  <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
                                      {item.file.name}
                                    </p>
                                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                                      {formatSize(item.file.size)}
                                    </p>
                                  </div>
                                  <FileReadingStatus reading={item.reading} />
                                  <button
                                    type="button"
                                    onClick={() => removeFile(item.id)}
                                    aria-label={lot.length === 1 ? "Rimuovi file" : `Rimuovi ${item.file.name}`}
                                    className="shrink-0 rounded-full p-1 text-zinc-400 hover:bg-zinc-200 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                                  >
                                    ×
                                  </button>
                                </div>
                                {lot.length > 1 ? (
                                  <input
                                    type="text"
                                    value={item.title}
                                    onChange={(e) => updateLotFile(item.id, { title: e.target.value })}
                                    placeholder="Titolo (facoltativo)"
                                    aria-label={`Titolo per ${item.file.name}`}
                                    className={`w-full ${INPUT_FIELD}`}
                                  />
                                ) : null}
                                {duplicate ? (
                                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
                                    <span>
                                      🔁 Sembra già presente in Hinthial come &laquo;{duplicate.filename}&raquo;
                                      {duplicate.createdAt
                                        ? `, caricato il ${new Date(duplicate.createdAt).toLocaleDateString("it-IT")}`
                                        : " (in questo stesso lotto)"}
                                      — stesso nome, stessa dimensione.
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => removeFile(item.id)}
                                      className="shrink-0 font-medium underline-offset-2 hover:underline"
                                    >
                                      Escludi dall&apos;importazione
                                    </button>
                                  </div>
                                ) : null}
                              </div>
                            );
                          })}
                          {lot.length > 1 ? (
                            <p className="text-xs text-zinc-500 dark:text-zinc-400">
                              {lot.length} file
                              {duplicates.filter(Boolean).length > 0
                                ? `, ${duplicates.filter(Boolean).length} possibile ${duplicates.filter(Boolean).length === 1 ? "duplicato" : "duplicati"}`
                                : ""}
                              . Hinthial li ha letti sul dispositivo, uno alla volta.
                            </p>
                          ) : null}
                          <div className="flex flex-wrap items-center gap-4">
                            <label className="w-fit cursor-pointer text-sm font-medium text-accent hover:underline">
                              ＋ Aggiungi altri file
                              <input
                                type="file"
                                multiple
                                className="sr-only"
                                aria-label="Aggiungi altri file"
                                onChange={(e) => {
                                  addFiles(Array.from(e.target.files ?? []));
                                  e.target.value = "";
                                }}
                              />
                            </label>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-3">
                          {/* Concept "Mirino" (v. FileDropZone): un'unica superficie, zona di rilascio e "clicca per scegliere"
                        insieme; il campo vero la ricopre, invisibile ma presente. Resta visibile anche mentre i file si leggono. */}
                          <FileDropZone
                            inputRef={fileInputRef}
                            state={zoneState}
                            progress={zoneProgress}
                            onFiles={(files) => addFiles(files)}
                            onInputBlur={handleFileInputBlur}
                          />
                          {/* Solo su smartphone --- su desktop capture non ha effetto e sarebbe ridondante. Fuori dal
                        riquadro sopra: dentro, la casella invisibile ne intercetterebbe il click. */}
                          <button
                            type="button"
                            onClick={handleCameraClick}
                            className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 md:hidden dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
                          >
                            📷 Scatta foto
                          </button>
                        </div>
                      )}

                      {/* FASE 17c: detto prima è un'attesa annunciata, scoperto dopo è un'app lenta. */}
                      {isImage && !creating ? (
                        <p className="text-sm text-zinc-500 dark:text-zinc-400">
                          Hinthial leggerà il testo scritto dentro
                          {lot.length > 1 ? " le immagini" : " l'immagine"}, sul tuo dispositivo, per renderlo
                          cercabile. Può richiedere qualche decina di secondi.
                        </p>
                      ) : null}

                      {/* FASE 19b: "scan_0012.pdf" e "IMG_4821.jpg" sono il motivo per cui poi non si ritrova niente. Con più file ognuno ha il suo titolo, nella sua riga. */}
                      {lot.length <= 1 ? (
                        <div className="flex flex-col gap-1">
                          <label
                            htmlFor="upload-title"
                            className="text-xs font-medium text-zinc-600 dark:text-zinc-400"
                          >
                            Titolo
                          </label>
                          <input
                            id="upload-title"
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder={
                              lot[0]?.file.name ?? "es. Polizza auto 2026"
                            }
                            className={`w-full ${INPUT_FIELD}`}
                          />
                          <p className="text-xs text-zinc-500 dark:text-zinc-400">
                            Lascia vuoto per usare il nome del file.
                          </p>
                        </div>
                      ) : null}
                    </div>
                  ) : mode === "record" ? (
                    <div className="flex flex-col gap-2">
                      <AudioVideoRecorder
                        onRecorded={setRecordedFile}
                        title="Registra un audio o un video"
                        description="Resta in memoria finché non salvi il contenuto qui sotto."
                        confirmLabel="Usa questa registrazione"
                      />
                      {recordedFile ? (
                        <p className="text-sm text-zinc-700 dark:text-zinc-300">
                          🎬 Pronta: {recordedFile.name}
                        </p>
                      ) : null}
                      <div className="flex flex-col gap-1">
                        <label
                          htmlFor="record-title"
                          className="text-xs font-medium text-zinc-600 dark:text-zinc-400"
                        >
                          Titolo
                        </label>
                        <input
                          id="record-title"
                          type="text"
                          value={title}
                          onChange={(e) => setTitle(e.target.value)}
                          placeholder={
                            recordedFile?.name ?? "es. Colloquio col notaio"
                          }
                          className={`w-full ${INPUT_FIELD}`}
                        />
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">
                          Lascia vuoto per usare il nome della registrazione.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-3">
                      <div className="flex flex-col gap-1">
                        <label
                          htmlFor="note-title"
                          className="text-xs font-medium text-zinc-600 dark:text-zinc-400"
                        >
                          Titolo
                        </label>
                        <input
                          id="note-title"
                          type="text"
                          value={noteTitle}
                          onChange={(e) => setNoteTitle(e.target.value)}
                          placeholder="es. Combinazione della cassaforte"
                          className={INPUT_FIELD}
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label
                          htmlFor="note-body"
                          className="text-xs font-medium text-zinc-600 dark:text-zinc-400"
                        >
                          Testo
                        </label>
                        <textarea
                          id="note-body"
                          rows={6}
                          value={noteBody}
                          onChange={(e) => setNoteBody(e.target.value)}
                          className={INPUT_FIELD}
                        />
                      </div>
                    </div>
                  )}

                  <button
                    type="button"
                    disabled={!canSubmit}
                    onClick={() => setActiveStep(3)}
                    className="w-full rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 disabled:opacity-50 sm:w-fit dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
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
                  {mode === "upload" && lot.length > 1 ? (
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">
                      Questi dettagli valgono per tutti i {lot.length} file.
                    </p>
                  ) : null}
                  <DocumentMetadataFields
                    idPrefix="upload"
                    categories={categories}
                    assets={assets}
                    dossiers={dossiers}
                    value={metadata}
                    onChange={setMetadata}
                    // Scadenza ed emittente non si chiedono più qui: emergono come proposta dopo il salvataggio (v. passi post-salvataggio).
                    showExpiry={false}
                    showIssuer={false}
                  />
                  {mode === "upload"
                    ? proposedGroups.map((group) => {
                        const key = group.label as string;
                        const choice = groupChoices[key] ?? { link: true, title: group.proposedDossierTitle ?? "" };
                        return (
                          <label
                            key={key}
                            className="flex items-start gap-2 rounded-2xl border border-brand/30 bg-brand/5 p-4 text-sm"
                          >
                            <input
                              type="checkbox"
                              checked={choice.link}
                              onChange={(e) => setGroupChoices((prev) => ({ ...prev, [key]: { ...choice, link: e.target.checked } }))}
                              className="mt-0.5"
                            />
                            <span>
                              {group.existingDossier ? (
                                <>
                                  {group.files.length === 1 ? "Questo documento sembra" : `Questi ${group.files.length} documenti sembrano`}{" "}
                                  appartenere a &laquo;{group.existingDossier.title}&raquo; (stesso nome: {key}). Aggiungerli?
                                </>
                              ) : (
                                <>
                                  Questi {group.files.length} documenti hanno lo stesso nome ({key}) e sembrano la stessa
                                  vicenda. Vuoi creare il fascicolo{" "}
                                  <input
                                    type="text"
                                    value={choice.title}
                                    disabled={!choice.link}
                                    onChange={(e) => setGroupChoices((prev) => ({ ...prev, [key]: { ...choice, title: e.target.value } }))}
                                    aria-label="Titolo del fascicolo proposto"
                                    className="mx-1 rounded-md border border-zinc-300 bg-white px-2 py-0.5 text-sm text-zinc-950 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
                                  />
                                  ?
                                </>
                              )}
                            </span>
                          </label>
                        );
                      })
                    : null}
                </AccordionStep>

                {savedDoc ? (
                  <>
                    <SavedMoment open={savedMoment} />
                    <AccordionStep
                      step={4}
                      state={savedMoment ? "todo" : stepState(4)}
                      title="Lettura dal dispositivo"
                      summary={savedMoment ? undefined : step4Summary}
                      separator="Da qui in poi lavora Hinthial."
                      onOpen={() => setActiveStep(4)}
                    >
                      {readingState === "own-text" ? (
                        <p className="text-sm text-zinc-500 dark:text-zinc-400">
                          È già testo: non c&apos;è altro da leggere.
                        </p>
                      ) : readingState === "cannot" ? (
                        <p className="text-sm text-zinc-500 dark:text-zinc-400">
                          Non so ancora leggere questo tipo di contenuto: lo
                          trovi per nome e note.
                        </p>
                      ) : readingState === "nothing" ? (
                        <p className="text-sm text-zinc-500 dark:text-zinc-400">
                          L&apos;ho guardato, ma non ci ho trovato testo.
                        </p>
                      ) : readingState === "never" ? (
                        <p className="text-sm text-zinc-500 dark:text-zinc-400">
                          Non l&apos;ho ancora letto.
                        </p>
                      ) : (
                        <>
                          <p className="text-sm text-zinc-500 dark:text-zinc-400">
                            {savedDoc.extractedText.length.toLocaleString(
                              "it-IT",
                            )}{" "}
                            caratteri letti.
                          </p>
                          <Link
                            href={`/archive/${savedDoc.id}`}
                            className="w-fit text-sm font-medium text-accent underline-offset-2 hover:underline"
                          >
                            Vedi tutto sulla scheda →
                          </Link>
                        </>
                      )}
                      <button
                        type="button"
                        onClick={() => setActiveStep(5)}
                        className="w-full rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 sm:w-fit dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
                      >
                        Continua →
                      </button>
                    </AccordionStep>

                    <AccordionStep
                      step={5}
                      state={aiDone && activeStep !== 5 ? "done" : stepState(5)}
                      last
                      title="Analisi di Hinthia"
                      summary={aiDone ? "Fatto" : "Opzionale"}
                      onOpen={() => setActiveStep(5)}
                    >
                      <p className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
                        {/* eslint-disable-next-line @next/next/no-img-element -- copia ridotta dell'avatar HINTHIA, v. public/brand/README.md */}
                        <img
                          src="/brand/hinthia/hinthia-64.png"
                          alt=""
                          className="h-5 w-5 shrink-0 rounded-full"
                        />
                        Facoltativa: se vuoi, Hinthia legge il testo e prepara
                        una sintesi.
                      </p>
                      {aiDone ? (
                        <p className="text-sm text-emerald-600 dark:text-emerald-400">
                          ✓ Fatto — trovi la sintesi e le proposte sulla scheda
                          del documento.
                        </p>
                      ) : (
                        <AIAnalysisTrigger
                          masterEnabled={masterEnabled}
                          extractionConsent={extractionConsent}
                          hasCategory={savedDoc.categoryId !== null}
                          categoryEnabled={categoryEnabledForAI}
                          excluded={savedDoc.aiExtractionExcluded}
                          busy={aiBusy}
                          progress={aiProgress}
                          savedState={savedAnalysis}
                          analyzedAtLabel={savedDoc.analysisUpdatedAt ? formatDate(savedDoc.analysisUpdatedAt) : null}
                          lastRunFailed={savedDoc.analysisStatus === "failed"}
                          onAnalyze={handleAnalyzeWithClaude}
                          onAbort={() => aiAbortRef.current?.abort()}
                          onToggleExcluded={handleToggleAIExclusion}
                        />
                      )}
                    </AccordionStep>
                  </>
                ) : null}
              </>
            ) : null}
          </AccordionCard>

          {error ? (
            <p role="alert" className="text-sm text-red-600 dark:text-red-400">
              {error}
            </p>
          ) : null}

          {savedDoc ? (
            <div className="flex flex-wrap gap-3">
              <Link
                href={`/archive/${savedDoc.id}`}
                className={BTN_PRIMARY}
              >
                Vai alla scheda del documento →
              </Link>
              <Link
                href="/archive?created=1"
                className={BTN_SECONDARY}
              >
                Torna all&apos;archivio
              </Link>
            </div>
          ) : (
            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                type="submit"
                disabled={creating || !canSubmit}
                className="w-full rounded-xl bg-brand px-4 py-2 sm:w-auto text-sm font-medium text-white hover:bg-brand-hover disabled:opacity-50"
              >
                {creating
                  ? lot.length > 1 && batchProgress
                    ? `Salvo ${Math.min(batchProgress.done + 1, batchProgress.total)} di ${batchProgress.total}…`
                    : phase === "reading"
                      ? readingLabel()
                      : "Salvataggio…"
                  : lot.length > 1
                    ? `Aggiungi ${lot.length} file all'archivio`
                    : "Aggiungi all'archivio"}
              </button>
              <Link
                href="/archive"
                className="w-full rounded-md border border-zinc-300 px-4 py-2 text-center text-sm font-medium text-zinc-700 hover:bg-zinc-100 sm:w-auto dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
              >
                Annulla
              </Link>
            </div>
          )}
        </form>
      )}
    </div>
  );
}
