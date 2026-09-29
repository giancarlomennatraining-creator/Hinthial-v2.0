"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
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
import { listCategories, grantCategoryAIExtractionTemporarily } from "@/domain/categories/repository";
import { isCategoryEnabledForExtraction } from "@/domain/categories/ai-consent";
import { listDossiers } from "@/domain/dossiers/repository";
import type { DossierListItem } from "@/domain/dossiers/types";
import { heuristicCategorizer } from "@/domain/categorizer/heuristic-provider";
import { canExtractText, extractText } from "@/domain/extraction/extract-text";
import { extractStructuredFields, type StructuredField } from "@/domain/extraction/structured-fields";
import { readingStateFor } from "@/domain/extraction/reading-state";
import { buildProposals } from "@/domain/proposals/build";
import type { Proposal } from "@/domain/proposals/types";
import { suggestAssetFromText } from "@/domain/proposals/asset-match";
import { analyzeDocumentWithClaude, type AIAnalysisScope } from "@/domain/ai/analyze-document";
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
import type { DocumentListItem, DocumentMetadataInput } from "@/domain/documents/types";

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

/** Concept C (v. Artifact discusso con l'utente): un passo alla volta, gli altri si riducono a un riepilogo con "Modifica". */
function AccordionStep({
  step,
  active,
  title,
  summary,
  onOpen,
  children,
}: {
  step: number;
  active: boolean;
  title: string;
  summary: React.ReactNode;
  onOpen: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-[0_8px_20px_rgba(16,24,40,0.04)] dark:border-zinc-800 dark:bg-zinc-950">
      <button
        type="button"
        onClick={onOpen}
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
      >
        <span className="flex min-w-0 items-center gap-3">
          <span
            className={
              active
                ? "flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand text-sm font-bold text-white"
                : "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-emerald-200 text-emerald-600 dark:border-emerald-900 dark:text-emerald-400"
            }
          >
            {active ? step : <CheckCircleIcon width={16} height={16} />}
          </span>
          <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{title}</span>
        </span>
        {active ? null : (
          <span className="flex min-w-0 items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
            <span className="truncate">{summary}</span>
            <span className="shrink-0 font-semibold text-brand">Modifica</span>
          </span>
        )}
      </button>
      {active ? <div className="flex flex-col gap-4 px-5 pb-5">{children}</div> : null}
    </div>
  );
}

/** Segno accanto al file scelto --- sostituisce il vecchio blocco "Ho letto il documento": un segno, non un riquadro a sé. */
function FileReadingStatus({ reading }: { reading: ReadingState }) {
  if (reading.status === "reading") {
    return (
      <span className="text-xs whitespace-nowrap text-zinc-500 dark:text-zinc-400">
        Lettura…{reading.progress === null ? "" : ` ${Math.round(reading.progress * 100)}%`}
      </span>
    );
  }
  if (reading.status === "skipped") {
    return (
      <span className="text-xs whitespace-nowrap text-zinc-500 dark:text-zinc-400">Non so ancora leggerlo</span>
    );
  }
  if (reading.status === "done") {
    return reading.text ? (
      <span className="flex items-center gap-1 text-xs font-medium whitespace-nowrap text-emerald-600 dark:text-emerald-400">
        <CheckCircleIcon width={14} height={14} /> Letto sul dispositivo
      </span>
    ) : (
      <span className="text-xs whitespace-nowrap text-zinc-500 dark:text-zinc-400">Nessun testo trovato</span>
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

  // Concept C (v2, v. feedback utente): quale dei tre passi è aperto --- gli altri restano come riepilogo, mai
  // tutti insieme. Parte dal passo 1: il primo input deve essere davvero la prima scelta dell'utente, non una
  // modalità già decisa per lui.
  const [activeStep, setActiveStep] = useState<1 | 2 | 3>(1);

  const [mode, setMode] = useState<CreationMode | null>(null);
  const [metadata, setMetadata] = useState<DocumentMetadataFieldsValue>(EMPTY_METADATA_FIELDS);
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
  const [aiBusy, setAiBusy] = useState(false);
  const [aiDone, setAiDone] = useState(false);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const [categoriesResult, assetsResult, dossiersResult] = await Promise.all([
        listCategories(supabase),
        listAssets(supabase, masterKey),
        listDossiers(supabase, masterKey),
      ]);
      setCategories(categoriesResult);
      setAssets(assetsResult);
      setDossiers(dossiersResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossibile caricare i dati necessari.");
    } finally {
      setLoading(false);
    }
  }, [supabase, masterKey]);

  useEffect(() => {
    // See DocumentsPanel.tsx for why fetch-on-mount is legitimate here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
  }, [refresh]);

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
      const fromFilename = heuristicCategorizer.suggestCategory(file.name, categories);
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
      if (token === readingTokenRef.current) setReading({ status: "done", text: null });
      return { text: null, attempted: false };
    }
  }

  /** Riempie i campi che Hinthial è riuscito a ricavare, e se lo segna. Scadenza/emittente non sono più qui: emergono come proposta dopo il salvataggio (v. passi post-salvataggio), non vanno indovinati prima. */
  function applySuggestions(file: File, text: string, fields: StructuredField[]) {
    const next: Suggested = {};

    // Il titolo si PROPONE, non si precompila --- unico campo che ha già sempre un valore (il nome del file), sostituirlo d'ufficio sarebbe scorretto.
    const proposedTitle = fields.find((f) => f.kind === "title")?.value;
    if (proposedTitle) {
      // L'estensione si conserva, altrimenti il sistema operativo non saprebbe più con cosa aprirlo.
      const extension = file.name.includes(".") ? file.name.slice(file.name.lastIndexOf(".")) : "";
      next.title = `${proposedTitle}${extension}`;
    }

    // Il bene ha la precedenza sulle parole chiave: una targa o polizza non è un indizio, è una certezza.
    const asset = suggestAssetFromText(text, assets);
    const categoryId = asset?.categoryId
      ? asset.categoryId
      : heuristicCategorizer.suggestCategoryFromContent(file.name, text, categories);

    if (categoryId) {
      next.categoryId = categoryId;
      if (asset && asset.categoryId === categoryId) next.relatedAssetId = asset.id;
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
        newId = await uploadDocument(supabase, masterKey, user.id, file, metadataInput, {
          title: mode === "upload" ? title : undefined,
          // Il file registrato non passa dalla lettura del form: lo legge uploadDocument come sempre.
          extraction: mode === "upload" ? await extractionForSave() : undefined,
          onPhase: (nextPhase, progress) => {
            setPhase(nextPhase);
            setReadProgress(progress);
          },
        });
      }

      // Concept D: invece del ritorno diretto a /archive, i passi su cosa Hinthial ne ha già ricavato e,
      // se vuoi, l'analisi con Claude --- prima di scegliere se andare sulla scheda o tornare all'archivio.
      const documents = await listDocuments(supabase, masterKey);
      const created = documents.find((d) => d.id === newId) ?? null;
      if (created) {
        setSavedDoc(created);
      } else {
        // Non dovrebbe succedere, ma senza il documento non c'è niente da mostrare nei passi.
        router.push("/archive?created=1");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossibile aggiungere il contenuto.");
      setCreating(false);
    }
  }

  /** Stesso principio di ArchiveItemDetail.handleAnalyzeWithClaude --- qui basta la sintesi: le proposte si accettano sulla scheda, non qui. */
  async function handleAnalyzeWithClaude(scope: AIAnalysisScope) {
    if (!savedDoc) return;
    if (!window.confirm("Il testo di questo documento verrà inviato a Hinthia. Continuare?")) {
      return;
    }

    setAiBusy(true);
    setError(null);
    try {
      if (scope === "temporary" && savedDoc.categoryId) {
        await grantCategoryAIExtractionTemporarily(supabase, savedDoc.categoryId, 30);
      }
      const fields = await analyzeDocumentWithClaude(savedDoc, categories, scope);
      if (fields.synthesis) {
        await saveAISynthesis(supabase, masterKey, savedDoc.id, fields.synthesis);
      }
      const documents = await listDocuments(supabase, masterKey);
      setSavedDoc(documents.find((d) => d.id === savedDoc.id) ?? savedDoc);
      setAiDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossibile analizzare il documento con Hinthia.");
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
      setError(err instanceof Error ? err.message : "Impossibile salvare l'esclusione.");
    }
  }

  // Il file in gioco, qualunque sia il modo --- serve a parlare del contenuto giusto ("l'immagine", non "il documento").
  const fileInHand = mode === "record" ? recordedFile : pickedFile;
  const isImage = fileInHand?.type.startsWith("image/") ?? false;

  function readingLabel(): string {
    const what = isImage ? "l'immagine" : "il documento";
    const percent = readProgress === null ? "" : ` ${Math.round(readProgress * 100)}%`;
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
  const step3Summary = step3Category ? `${step3Category.icon} ${step3Category.name}` : "Nessun dettaglio aggiunto";

  // --- Dopo il salvataggio: Concept D (v. Artifact) --- i passi invece del ritorno diretto all'archivio.
  if (savedDoc) {
    const aiCategory = categories.find((c) => c.id === savedDoc.categoryId);
    const categoryEnabledForAI = aiCategory ? isCategoryEnabledForExtraction(aiCategory) : false;
    const readingState = readingStateFor(savedDoc);
    // Nessun rifiuto ancora possibile su un documento appena nato: lo stesso meccanismo della scheda, senza cronologia.
    const localProposals: Proposal[] = buildProposals(savedDoc, categories, []);

    function proposalChipLabel(p: Proposal): string {
      if (p.kind === "expiry") return `📅 Scadenza — ${formatDate(p.value)}`;
      if (p.kind === "issuer") return `🏛️ Emittente — ${p.value}`;
      const cat = categories.find((c) => c.id === p.value);
      return `🗂️ Categoria — ${cat ? `${cat.icon} ${cat.name}` : p.value}`;
    }

    return (
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <span className="flex items-center gap-1.5 text-sm font-semibold text-emerald-600 dark:text-emerald-400">
            <CheckCircleIcon width={16} height={16} /> Documento salvato
          </span>
          <h1 className="text-2xl font-semibold tracking-tight text-brand">{savedDoc.filename}</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            È già nel tuo Archivio. Ecco cosa succede adesso, come quando riapri un contenuto.
          </p>
        </div>

        {error ? (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        ) : null}

        <div className="flex flex-col gap-4">
          <div className="flex items-start gap-3 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
            <CheckCircleIcon
              width={20}
              height={20}
              className="mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400"
            />
            <div>
              <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Salvato in Archivio</p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Cifrato sul tuo dispositivo prima ancora di essere inviato.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
            <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Lettura sul dispositivo (OCR)</p>
            {readingState === "own-text" ? (
              <p className="text-sm text-zinc-500 dark:text-zinc-400">È già testo: non c&apos;è altro da leggere.</p>
            ) : readingState === "cannot" ? (
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Non so ancora leggere questo tipo di contenuto: lo trovi per nome, tag e note.
              </p>
            ) : readingState === "nothing" ? (
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                L&apos;ho guardato, ma non ci ho trovato testo.
              </p>
            ) : readingState === "never" ? (
              <p className="text-sm text-zinc-500 dark:text-zinc-400">Non l&apos;ho ancora letto.</p>
            ) : (
              <>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  {savedDoc.extractedText.length.toLocaleString("it-IT")} caratteri letti
                  {localProposals.length > 0 ? " --- ecco cosa ho trovato:" : "."}
                </p>
                {localProposals.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {localProposals.map((p, i) => (
                      <span key={i} className="rounded-lg bg-brand/10 px-3 py-1.5 text-xs font-medium text-brand">
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
          </div>

          <div className="flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
            <p className="flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              {/* eslint-disable-next-line @next/next/no-img-element -- copia ridotta dell'avatar HINTHIA, v. public/brand/README.md */}
              <img src="/brand/hinthia/hinthia-64.png" alt="" className="h-5 w-5 shrink-0 rounded-full" />
              Analisi con Hinthia <span className="font-normal text-zinc-500 dark:text-zinc-400">(opzionale)</span>
            </p>
            {aiDone ? (
              <p className="text-sm text-emerald-600 dark:text-emerald-400">
                ✓ Fatto --- trovi la sintesi e le proposte sulla scheda del documento.
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
          </div>
        </div>

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
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/archive"
          className="text-sm font-medium text-zinc-500 underline-offset-2 hover:underline dark:text-zinc-400"
        >
          ← Torna all&apos;archivio
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-brand">Nuovo contenuto</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Documenti, immagini, audio, video o una nota scritta al momento --- tutto cifrato sul tuo dispositivo prima
          di essere salvato.
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Caricamento…</p>
      ) : (
        <form onSubmit={handleCreate} className="flex flex-col gap-4">
          <AccordionStep
            step={1}
            active={activeStep === 1}
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
            <div role="radiogroup" aria-label="Tipo di contenuto" className="grid grid-cols-1 gap-3 sm:grid-cols-3">
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
                  <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{MODE_LABEL[option]}</span>
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">{MODE_DESCRIPTION[option]}</span>
                </button>
              ))}
            </div>
          </AccordionStep>

          {mode ? (
          <>
          <AccordionStep
            step={2}
            active={activeStep === 2}
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
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">{formatSize(pickedFile.size)}</p>
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
                        onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
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
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">PDF, immagini, file di testo</p>
                    </div>
                    {/* Solo su smartphone --- su desktop capture non ha effetto e sarebbe ridondante. Fuori dal
                        riquadro sopra: dentro, la casella invisibile ne intercetterebbe il click. */}
                    <button
                      type="button"
                      onClick={handleCameraClick}
                      className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100 md:hidden dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
                    >
                      📷 Scatta foto
                    </button>
                  </div>
                )}

                {/* FASE 17c: detto prima è un'attesa annunciata, scoperto dopo è un'app lenta. */}
                {isImage && !creating ? (
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">
                    Hinthial leggerà il testo scritto dentro l&apos;immagine, sul tuo dispositivo, per renderlo
                    cercabile. Può richiedere qualche decina di secondi.
                  </p>
                ) : null}

                {/* FASE 19b: "scan_0012.pdf" e "IMG_4821.jpg" sono il motivo per cui poi non si ritrova niente. */}
                {pickedFile ? (
                  <div className="flex flex-col gap-1">
                    <label htmlFor="upload-title" className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                      Titolo
                    </label>
                    <input
                      id="upload-title"
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder={pickedFile.name}
                      className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
                    />
                    {suggested.title && title === suggested.title ? (
                      <SuggestedHint>Titolo suggerito da Hinthial</SuggestedHint>
                    ) : suggested.title ? (
                      <button
                        type="button"
                        onClick={() => setTitle(suggested.title!)}
                        className="self-start text-left text-xs text-brand underline-offset-2 hover:underline"
                      >
                        ✨ Usa il titolo che ho ricavato: &laquo;{suggested.title}&raquo;
                      </button>
                    ) : (
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">
                        Lascia vuoto per usare il nome del file.
                      </p>
                    )}
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
                  <p className="text-sm text-zinc-700 dark:text-zinc-300">🎬 Pronta: {recordedFile.name}</p>
                ) : null}
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-1">
                  <label htmlFor="note-title" className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
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
                  <label htmlFor="note-body" className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
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
              className="w-fit rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
            >
              Continua →
            </button>
          </AccordionStep>

          <AccordionStep
            step={3}
            active={activeStep === 3}
            title="Aiutaci a ritrovarlo"
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
                  suggested.categoryId && metadata.categoryId === suggested.categoryId ? (
                    <SuggestedHint>Suggerita da Hinthial</SuggestedHint>
                  ) : null,
                relatedAssetId:
                  suggested.relatedAssetId && metadata.relatedAssetId === suggested.relatedAssetId ? (
                    <SuggestedHint>Riconosciuto nel documento</SuggestedHint>
                  ) : null,
              }}
            />
          </AccordionStep>
          </>
          ) : null}

          {error ? (
            <p role="alert" className="text-sm text-red-600 dark:text-red-400">
              {error}
            </p>
          ) : null}

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={creating || !canSubmit}
              className="rounded-xl bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-hover disabled:opacity-50"
            >
              {creating ? (phase === "reading" ? readingLabel() : "Salvataggio…") : "Aggiungi all'archivio"}
            </button>
            <Link
              href="/archive"
              className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
            >
              Annulla
            </Link>
          </div>
        </form>
      )}
    </div>
  );
}
