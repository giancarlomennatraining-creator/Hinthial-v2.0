"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/db/supabase/client";
import {
  createTextNote,
  listDocuments,
  saveAISynthesis,
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
import { listDossiers } from "@/domain/dossiers/repository";
import type { DossierListItem } from "@/domain/dossiers/types";
import { heuristicCategorizer } from "@/domain/categorizer/heuristic-provider";
import { canExtractText, extractText } from "@/domain/extraction/extract-text";
import {
  extractStructuredFields,
  type StructuredField,
} from "@/domain/extraction/structured-fields";
import { readingStateFor } from "@/domain/extraction/reading-state";
import { buildProposals } from "@/domain/proposals/build";
import type { Proposal } from "@/domain/proposals/types";
import { suggestAssetFromText } from "@/domain/proposals/asset-match";
import {
  analysisConfirmMessage,
  analyzeDocumentWithClaude,
  planAnalysis,
  type AIAnalysisScope,
} from "@/domain/ai/analyze-document";
import { useAIProcessingConsent } from "@/components/ai/AIProcessingConsentProvider";
import { AIAnalysisTrigger } from "@/components/documents/AIAnalysisTrigger";
import { CheckCircleIcon } from "@/components/icons/nav-icons";
import { formatDate, formatSize } from "@/lib/format";
import { AudioVideoRecorder } from "@/components/media/AudioVideoRecorder";
import {
  DocumentMetadataFields,
  EMPTY_METADATA_FIELDS,
  parseTagsInput,
  type DocumentMetadataFieldsValue,
} from "@/components/documents/DocumentMetadataFields";
import type { Category } from "@/domain/categories/types";
import type { AssetListItem } from "@/domain/assets/types";
import type {
  DocumentListItem,
  DocumentMetadataInput,
} from "@/domain/documents/types";

type CreationMode = "upload" | "record" | "note";

/** FASE 19b: stato della lettura --- "skipped" (tipo non leggibile) è diverso da "done" senza risultato. */
type ReadingState =
  | { status: "idle" }
  | { status: "reading"; progress: number | null }
  | { status: "skipped" }
  | { status: "done"; text: string | null };

/** I valori messi da Hinthial, per distinguerli da quelli scritti a mano. */
interface Suggested {
  title?: string;
  categoryId?: string;
  relatedAssetId?: string;
}

/** Il segno accanto a un campo riempito da Hinthial. */
function SuggestedHint({ children }: { children: React.ReactNode }) {
  return (
    <p className="line-clamp-2 max-w-[16rem] text-xs text-zinc-500 dark:text-zinc-400">
      <span className="text-brand">✨</span> {children}
    </p>
  );
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
  upload: "bollette, contratti, referti",
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
                <span className="shrink-0 font-semibold text-brand">
                  Modifica
                </span>
              )}
            </span>
          )}
        </button>
        <div className="step-body" data-open={active ? "true" : "false"}>
          <div className="step-inner" inert={!active}>
            {mounted ? (
              <div className="flex flex-col gap-4 px-5 pb-5 sm:pl-[3.75rem]">
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
  const supabase = useRef(createClient()).current;
  const router = useRouter();
  const searchParams = useSearchParams();
  const { masterEnabled, extractionConsent } = useAIProcessingConsent();

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
  const [pickedFile, setPickedFile] = useState<File | null>(null);

  // FASE 19b: la lettura parte appena scegli il file, non a Salva --- avviene dentro il tempo che stavi già spendendo.
  const [reading, setReading] = useState<ReadingState>({ status: "idle" });
  const [title, setTitle] = useState("");
  /** Cosa ha messo Hinthial --- sparisce appena l'utente tocca il campo, da quel momento il valore è suo. */
  const [suggested, setSuggested] = useState<Suggested>({});
  // Identifica il file in lettura: se ne scegli un altro prima che finisca, il risultato vecchio non deve sovrascrivere.
  const readingTokenRef = useRef(0);
  // La lettura in corso, per poterla aspettare al salvataggio se non ha ancora finito (v. extractionForSave).
  const readingPromiseRef = useRef<Promise<PriorExtraction> | null>(null);
  const [recordedFile, setRecordedFile] = useState<File | null>(null);
  const [noteTitle, setNoteTitle] = useState("");
  const [noteBody, setNoteBody] = useState("");

  // Concept D: dopo il salvataggio, il documento appena creato e i passi su cosa farne --- invece del ritorno
  // diretto all'archivio. `null` = form ancora in corso.
  const [savedDoc, setSavedDoc] = useState<DocumentListItem | null>(null);
  const [savedMoment, setSavedMoment] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiDone, setAiDone] = useState(false);

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
    setPickedFile(null);
    setRecordedFile(null);
    setError(null);
    // Azzera anche ciò che Hinthial aveva ricavato: una lettura in corso non deve riempire i campi di una nota scritta a mano.
    readingTokenRef.current++;
    setReading({ status: "idle" });
    setTitle("");
    setSuggested({});
    setMetadata(EMPTY_METADATA_FIELDS);
  }

  function pickFile(file: File | null) {
    setPickedFile(file);
    // Non si azzerano titolo/categoria/bene/fascicolo/tag/note ("non si tocca ciò che è già compilato") --- solo il segno "suggerito", legato al file precedente.
    setSuggested({});
    if (file) {
      readingPromiseRef.current = readPickedFile(file);
    } else {
      readingPromiseRef.current = null;
      setReading({ status: "idle" });
    }
  }

  function handleRemoveFile() {
    readingTokenRef.current++;
    pickFile(null);
    setTitle("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleDropFile(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    pickFile(event.dataTransfer.files?.[0] ?? null);
  }

  /** FASE 19b: legge il file e precompila --- niente di tuo da sovrascrivere ancora, vedere il valore e premere Salva È il consenso (diverso da ProposalsSection, dove il campo può essere già tuo). */
  async function readPickedFile(file: File): Promise<PriorExtraction> {
    const token = ++readingTokenRef.current;
    const mimeType = file.type || "application/octet-stream";

    if (!canExtractText(mimeType)) {
      setReading({ status: "skipped" });
      // Niente testo da leggere: resta il nome del file, l'unico indizio disponibile.
      const fromFilename = heuristicCategorizer.suggestCategory(
        file.name,
        categories,
      );
      if (fromFilename) {
        setMetadata((prev) => ({ ...prev, categoryId: fromFilename }));
        setSuggested({ categoryId: fromFilename });
      }
      return { text: null, attempted: false };
    }

    setReading({ status: "reading", progress: null });
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const text = await extractText(bytes, mimeType, (progress) => {
        if (token !== readingTokenRef.current) return;
        setReading({ status: "reading", progress });
        setReadProgress(progress);
      });

      // Un altro file è stato scelto nel frattempo: risultato vecchio, non tocca niente (v. readingPromiseRef).
      if (token === readingTokenRef.current) {
        const fields = text ? extractStructuredFields(text) : [];
        setReading({ status: "done", text });
        applySuggestions(file, text ?? "", fields);
      }

      return { text, attempted: true };
    } catch {
      // Leggere è un di più: un file illeggibile non deve impedire di salvarlo.
      if (token === readingTokenRef.current)
        setReading({ status: "done", text: null });
      return { text: null, attempted: false };
    }
  }

  /** Riempie i campi che Hinthial è riuscito a ricavare, e se lo segna. Scadenza/emittente non sono più qui: emergono come proposta dopo il salvataggio (v. passi post-salvataggio), non vanno indovinati prima. */
  function applySuggestions(
    file: File,
    text: string,
    fields: StructuredField[],
  ) {
    const next: Suggested = {};

    // Il titolo si PROPONE, non si precompila --- unico campo che ha già sempre un valore (il nome del file), sostituirlo d'ufficio sarebbe scorretto.
    const proposedTitle = fields.find((f) => f.kind === "title")?.value;
    if (proposedTitle) {
      // L'estensione si conserva, altrimenti il sistema operativo non saprebbe più con cosa aprirlo.
      const extension = file.name.includes(".")
        ? file.name.slice(file.name.lastIndexOf("."))
        : "";
      next.title = `${proposedTitle}${extension}`;
    }

    // Il bene ha la precedenza sulle parole chiave: una targa o polizza non è un indizio, è una certezza.
    const asset = suggestAssetFromText(text, assets);
    const categoryId = asset?.categoryId
      ? asset.categoryId
      : heuristicCategorizer.suggestCategoryFromContent(
          file.name,
          text,
          categories,
        );

    if (categoryId) {
      next.categoryId = categoryId;
      if (asset && asset.categoryId === categoryId)
        next.relatedAssetId = asset.id;
    }

    setSuggested(next);
    setMetadata((prev) => ({
      ...prev,
      categoryId: next.categoryId ?? prev.categoryId,
      relatedAssetId: next.relatedAssetId ?? prev.relatedAssetId,
    }));
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

  /** Il risultato della lettura per il salvataggio --- se non ha ancora finito si aspetta (era già in corso dalla scelta del file), altrimenti il documento nascerebbe non cercabile. */
  async function extractionForSave(): Promise<PriorExtraction> {
    const pending = readingPromiseRef.current;
    if (!pending) return { text: null, attempted: false };
    if (reading.status === "reading") setPhase("reading");
    return pending;
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (savedDoc) return;
    setError(null);

    if (mode === "note" && !noteTitle.trim()) {
      setError("Inserisci un titolo per la nota.");
      return;
    }
    if (mode === "upload" && !pickedFile) {
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
        tags: parseTagsInput(metadata.tagsInput),
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
      } else {
        const file = mode === "record" ? recordedFile! : pickedFile!;
        newId = await uploadDocument(
          supabase,
          masterKey,
          user.id,
          file,
          metadataInput,
          {
            title: mode === "record" ? recordingTitle(title, file.name) : title,
            // Il file registrato non passa dalla lettura del form: lo legge uploadDocument come sempre.
            extraction:
              mode === "upload" ? await extractionForSave() : undefined,
            onPhase: (nextPhase, progress) => {
              setPhase(nextPhase);
              setReadProgress(progress);
            },
          },
        );
      }

      // Invece del ritorno diretto a /archive, i passi 4 e 5 (cosa Hinthial ne ha già ricavato e, se vuoi,
      // l'analisi con Claude) --- prima di scegliere se andare sulla scheda o tornare all'archivio.
      const documents = await listDocuments(supabase, masterKey);
      const created = documents.find((d) => d.id === newId) ?? null;
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
  async function handleAnalyzeWithClaude(scope: AIAnalysisScope) {
    if (!savedDoc) return;
    if (
      !window.confirm(analysisConfirmMessage(planAnalysis(savedDoc)))
    ) {
      return;
    }

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
      );
      if (fields.synthesis) {
        await saveAISynthesis(
          supabase,
          masterKey,
          savedDoc.id,
          fields.synthesis,
        );
      }
      const documents = await listDocuments(supabase, masterKey);
      setSavedDoc(documents.find((d) => d.id === savedDoc.id) ?? savedDoc);
      setAiDone(true);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Impossibile analizzare il documento con Hinthia.",
      );
    } finally {
      setAiBusy(false);
    }
  }

  async function handleToggleAIExclusion(next: boolean) {
    if (!savedDoc) return;
    setError(null);
    try {
      await updateDocumentAIExtractionExclusion(supabase, savedDoc.id, next);
      const documents = await listDocuments(supabase, masterKey);
      setSavedDoc(documents.find((d) => d.id === savedDoc.id) ?? savedDoc);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Impossibile salvare l'esclusione.",
      );
    }
  }

  // Il file in gioco, qualunque sia il modo --- serve a parlare del contenuto giusto ("l'immagine", non "il documento").
  const fileInHand = mode === "record" ? recordedFile : pickedFile;
  const isImage = fileInHand?.type.startsWith("image/") ?? false;

  function readingLabel(): string {
    const what = isImage ? "l'immagine" : "il documento";
    const percent =
      readProgress === null ? "" : ` ${Math.round(readProgress * 100)}%`;
    return `Sto leggendo ${what}…${percent}`;
  }

  const canSubmit =
    (mode === "upload" && pickedFile) ||
    (mode === "record" && recordedFile) ||
    (mode === "note" && noteTitle.trim());

  const step2Summary =
    mode === "upload"
      ? (pickedFile?.name ?? "Nessun file scelto")
      : mode === "record"
        ? recordedFile
          ? "Registrazione pronta"
          : "Nessuna registrazione"
        : mode === "note"
          ? noteTitle || "Nota senza titolo"
          : "";

  const step3Category = categories.find((c) => c.id === metadata.categoryId);
  const step3Summary = step3Category
    ? `${step3Category.icon} ${step3Category.name}`
    : "Nessun dettaglio aggiunto";

  // --- Dopo il salvataggio: i passi 4 e 5 nella stessa fisarmonica.
  const aiCategory = savedDoc
    ? categories.find((c) => c.id === savedDoc.categoryId)
    : undefined;
  const categoryEnabledForAI = aiCategory
    ? isCategoryEnabledForExtraction(aiCategory)
    : false;
  const readingState = savedDoc ? readingStateFor(savedDoc) : null;
  // Nessun rifiuto ancora possibile su un documento appena nato: lo stesso meccanismo della scheda, senza cronologia.
  const localProposals: Proposal[] = savedDoc
    ? buildProposals(savedDoc, categories, [])
    : [];

  function proposalChipLabel(p: Proposal): string {
    if (p.kind === "expiry") return `📅 Scadenza — ${formatDate(p.value)}`;
    if (p.kind === "issuer") return `🏛️ Emittente — ${p.value}`;
    const cat = categories.find((c) => c.id === p.value);
    return `🗂️ Categoria — ${cat ? `${cat.icon} ${cat.name}` : p.value}`;
  }

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
          <h1 className="text-2xl font-semibold tracking-tight text-brand">
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
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-brand">
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
                      {pickedFile ? (
                        <div className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900">
                          <span className="text-xl" aria-hidden="true">
                            📄
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
                              {pickedFile.name}
                            </p>
                            <p className="text-xs text-zinc-500 dark:text-zinc-400">
                              {formatSize(pickedFile.size)}
                            </p>
                          </div>
                          <FileReadingStatus reading={reading} />
                          <button
                            type="button"
                            onClick={handleRemoveFile}
                            aria-label="Rimuovi file"
                            className="shrink-0 rounded-full p-1 text-zinc-400 hover:bg-zinc-200 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                          >
                            ×
                          </button>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-3">
                          {/* Concept pulito (v. feedback utente): un'unica superficie, non due messaggi sovrapposti ---
                        l'intero riquadro è insieme zona di rilascio e "clicca per scegliere": la casella nativa
                        lo ricopre per intero, invisibile ma presente (non `hidden`: resta un vero controllo,
                        raggiungibile da tastiera e da chi verifica l'interfaccia), un solo messaggio sopra. */}
                          <div
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={handleDropFile}
                            className="relative flex w-full flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-zinc-300 p-8 text-center dark:border-zinc-700"
                          >
                            <input
                              id="file"
                              ref={fileInputRef}
                              type="file"
                              onChange={(e) =>
                                pickFile(e.target.files?.[0] ?? null)
                              }
                              onBlur={handleFileInputBlur}
                              aria-label="Scegli un file"
                              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                            />
                            <span className="text-3xl" aria-hidden="true">
                              📎
                            </span>
                            <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                              Trascina qui un documento, o clicca per sceglierlo
                            </p>
                            <p className="text-xs text-zinc-500 dark:text-zinc-400">
                              PDF, immagini, file di testo
                            </p>
                          </div>
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
                          l&apos;immagine, sul tuo dispositivo, per renderlo
                          cercabile. Può richiedere qualche decina di secondi.
                        </p>
                      ) : null}

                      {/* FASE 19b: "scan_0012.pdf" e "IMG_4821.jpg" sono il motivo per cui poi non si ritrova niente. */}
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
                            pickedFile?.name ?? "es. Polizza auto 2026"
                          }
                          className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
                        />
                        {suggested.title && title === suggested.title ? (
                          <SuggestedHint>
                            Titolo suggerito da Hinthial
                          </SuggestedHint>
                        ) : suggested.title ? (
                          <button
                            type="button"
                            onClick={() => setTitle(suggested.title!)}
                            className="self-start text-left text-xs text-brand underline-offset-2 hover:underline"
                          >
                            ✨ Usa il titolo che ho ricavato: &laquo;
                            {suggested.title}&raquo;
                          </button>
                        ) : (
                          <p className="text-xs text-zinc-500 dark:text-zinc-400">
                            Lascia vuoto per usare il nome del file.
                          </p>
                        )}
                      </div>
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
                          className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
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
                          className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
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
                          className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
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
                    hints={{
                      categoryId:
                        suggested.categoryId &&
                        metadata.categoryId === suggested.categoryId ? (
                          <SuggestedHint>Suggerita da Hinthial</SuggestedHint>
                        ) : null,
                      relatedAssetId:
                        suggested.relatedAssetId &&
                        metadata.relatedAssetId === suggested.relatedAssetId ? (
                          <SuggestedHint>
                            Riconosciuto nel documento
                          </SuggestedHint>
                        ) : null,
                    }}
                  />
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
                          trovi per nome, tag e note.
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
                            caratteri letti
                            {localProposals.length > 0
                              ? " — ecco cosa ho trovato:"
                              : "."}
                          </p>
                          {localProposals.length > 0 ? (
                            <div className="flex flex-wrap gap-2">
                              {localProposals.map((p, i) => (
                                <span
                                  key={i}
                                  className="rounded-lg bg-brand/10 px-3 py-1.5 text-xs font-medium text-brand"
                                >
                                  {proposalChipLabel(p)}
                                </span>
                              ))}
                            </div>
                          ) : null}
                          <Link
                            href={`/archive/${savedDoc.id}`}
                            className="w-fit text-sm font-medium text-brand underline-offset-2 hover:underline"
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
                          onAnalyze={handleAnalyzeWithClaude}
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
                className="rounded-xl bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-hover"
              >
                Vai alla scheda del documento →
              </Link>
              <Link
                href="/archive?created=1"
                className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
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
                  ? phase === "reading"
                    ? readingLabel()
                    : "Salvataggio…"
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
