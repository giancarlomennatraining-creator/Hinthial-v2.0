"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/db/supabase/client";
import {
  createTextNote,
  uploadDocument,
  type PriorExtraction,
  type UploadPhase,
} from "@/domain/documents/repository";
import { listAssets } from "@/domain/assets/repository";
import { listCategories } from "@/domain/categories/repository";
import { listDossiers } from "@/domain/dossiers/repository";
import type { DossierListItem } from "@/domain/dossiers/types";
import { heuristicCategorizer } from "@/domain/categorizer/heuristic-provider";
import { canExtractText, extractText } from "@/domain/extraction/extract-text";
import {
  extractStructuredFields,
  findDateContext,
  type StructuredField,
  type StructuredFieldKind,
} from "@/domain/extraction/structured-fields";
import { suggestAssetFromText } from "@/domain/proposals/asset-match";
import { formatDate } from "@/lib/format";
import { AudioVideoRecorder } from "@/components/media/AudioVideoRecorder";
import {
  DocumentMetadataFields,
  EMPTY_METADATA_FIELDS,
  parseTagsInput,
  type DocumentMetadataFieldsValue,
} from "@/components/documents/DocumentMetadataFields";
import type { Category } from "@/domain/categories/types";
import type { AssetListItem } from "@/domain/assets/types";
import type { DocumentMetadataInput } from "@/domain/documents/types";

type CreationMode = "upload" | "record" | "note";

/**
 * FASE 19b --- lo stato della lettura del file appena scelto.
 * "skipped" è un tipo che Hinthial non sa ancora leggere (un audio):
 * diverso da "done" senza risultato, e va detto in modo diverso.
 */
type ReadingState =
  | { status: "idle" }
  | { status: "reading"; progress: number | null }
  | { status: "skipped" }
  | { status: "done"; text: string | null; fields: StructuredField[] };

/** I valori messi da Hinthial, per distinguerli da quelli scritti a mano. */
interface Suggested {
  title?: string;
  categoryId?: string;
  relatedAssetId?: string;
  expiresAt?: string;
}

/** Il segno accanto a un campo riempito da Hinthial. */
function SuggestedHint({ children }: { children: React.ReactNode }) {
  return (
    <p className="line-clamp-2 max-w-[16rem] text-xs text-zinc-500 dark:text-zinc-400">
      <span className="text-brand">✨</span> {children}
    </p>
  );
}

/** Le voci ricavate che si mostrano nel form, nell'ordine in cui servono. */
const REPORTED_FIELDS: { kind: StructuredFieldKind; label: string }[] = [
  { kind: "issuer", label: "Emittente" },
  { kind: "document-date", label: "Data del documento" },
  { kind: "amount", label: "Importo" },
];

/**
 * FASE 19b --- "ho letto il documento", nel form di caricamento.
 *
 * Mostra solo le voci che **non** hanno già un campo proprio qui sotto:
 * titolo, categoria e scadenza sono già precompilati, e ripeterli
 * sarebbe lo stesso valore due volte a due centimetri di distanza.
 */
function ReadingReport({ reading }: { reading: ReadingState }) {
  if (reading.status === "idle") return null;

  if (reading.status === "reading") {
    return (
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        Sto leggendo il documento…
        {reading.progress === null ? "" : ` ${Math.round(reading.progress * 100)}%`}
      </p>
    );
  }

  if (reading.status === "skipped") {
    return (
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        Questo tipo di contenuto non lo so ancora leggere: lo trovi per nome, tag e note.
      </p>
    );
  }

  if (!reading.text) {
    return (
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        L&apos;ho guardato, ma non ci ho trovato testo.
      </p>
    );
  }

  const reported = REPORTED_FIELDS.map((entry) => ({
    ...entry,
    field: reading.fields.find((f) => f.kind === entry.kind),
  })).filter((entry) => entry.field);

  return (
    <div className="mt-1 flex flex-col gap-2 rounded-xl border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900">
      <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
        ✓ Ho letto il documento{" "}
        <span className="font-normal text-zinc-500 dark:text-zinc-400">
          --- {reading.text.length.toLocaleString("it-IT")} caratteri
        </span>
      </p>
      {reported.map(({ kind, label, field }) => (
        <div key={kind} className="min-w-0">
          <p className="flex flex-wrap items-baseline gap-2 text-sm">
            <span className="text-xs text-zinc-500 dark:text-zinc-400">{label}</span>
            <span className="font-medium text-zinc-900 dark:text-zinc-100">
              {field!.kind === "document-date" ? formatDate(field!.value) : field!.raw}
            </span>
          </p>
          {field!.context === field!.value ? null : (
            <p className="truncate text-xs text-zinc-500 italic dark:text-zinc-400">
              {field!.context}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

/**
 * FASE 19b --- da dove viene la scadenza che c'è nel campo, **qualunque
 * essa sia**.
 *
 * È il pezzo richiesto esplicitamente dall'utente, e il suo valore sta
 * nel caso più frequente: non che Hinthial non trovi la data, ma che ne
 * trovi cinque e scelga quella sbagliata (una polizza ha emissione,
 * decorrenza, scadenza, stampa). Correggi, e lei ritrova nel documento
 * la frase che contiene la data giusta --- prova che la tua correzione
 * corrisponde a qualcosa di scritto davvero.
 *
 * Il confronto è tra **date**, non tra stringhe: dal calendario arriva
 * `2027-06-03`, il documento dice "3 giugno 2027" (v. findDateContext).
 *
 * E deve saper dire "non l'ho trovata", che succede spesso e per buoni
 * motivi: l'OCR l'ha storpiata, la scadenza è calcolata e sul foglio non
 * c'è, oppure la sai tu da fuori.
 */
function ExpiryHint({
  metadata,
  suggested,
  reading,
}: {
  metadata: DocumentMetadataFieldsValue;
  suggested: Suggested;
  reading: ReadingState;
}) {
  if (!metadata.expiresAt || reading.status !== "done" || !reading.text) return null;

  // Valore ancora quello proposto: si riusa ciò che l'estrazione sapeva
  // già, compreso il fatto che potrebbe essere stata *calcolata* e
  // quindi giustamente introvabile nel testo.
  if (suggested.expiresAt && metadata.expiresAt === suggested.expiresAt) {
    const field = reading.fields.find((f) => f.kind === "expiry");
    if (field?.derived) {
      return <SuggestedHint>Calcolata da Hinthial: {field.context}</SuggestedHint>;
    }
    if (field) return <SuggestedHint>Trovata nel documento: {field.context}</SuggestedHint>;
  }

  const context = findDateContext(reading.text, metadata.expiresAt);
  if (context) {
    return (
      <p className="line-clamp-2 max-w-[16rem] text-xs text-zinc-500 dark:text-zinc-400">
        Nel documento: <span className="italic">{context}</span>
      </p>
    );
  }

  return (
    <p className="line-clamp-2 max-w-[16rem] text-xs text-zinc-500 dark:text-zinc-400">
      Questa data nel documento non l&apos;ho trovata. La salvo lo stesso.
    </p>
  );
}

const MODE_LABEL: Record<CreationMode, string> = {
  upload: "Carica un file",
  record: "Registra audio/video",
  note: "Scrivi una nota",
};

/**
 * Pagina dedicata alla creazione di un elemento d'Archivio (estratta da
 * DocumentsPanel, che ora mostra solo l'elenco più un tasto "+ Aggiungi
 * contenuto") --- un unico form per i tre modi di aggiungere qualcosa:
 * caricare un file già pronto, registrarne uno sul momento, o scrivere
 * una nota testuale (v. domain/documents/repository.ts, createTextNote).
 * Categoria/bene/scadenza/tag/note restano gli stessi a prescindere dal
 * tipo. Stesso pattern usato per capsule/beni/scadenze/contatti: alla
 * creazione riuscita torna a /archive con un messaggio di conferma
 * passato come flag nell'URL (`?created=1`).
 */
export function CreateArchiveItemForm({ masterKey }: { masterKey: CryptoKey }) {
  const supabase = useRef(createClient()).current;
  const router = useRouter();

  const [categories, setCategories] = useState<Category[]>([]);
  const [assets, setAssets] = useState<AssetListItem[]>([]);
  const [dossiers, setDossiers] = useState<DossierListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  // FASE 17b --- leggere un PDF lungo richiede qualche secondo: dirlo
  // evita che il pulsante annunci "Salvataggio…" mentre in realtà sta
  // ancora leggendo il documento (v. richiesta utente). FASE 17c: l'OCR
  // di una foto può richiederne venti, e allora la percentuale non è un
  // vezzo --- è ciò che distingue un'attesa lunga da un blocco.
  const [phase, setPhase] = useState<UploadPhase>("saving");
  const [readProgress, setReadProgress] = useState<number | null>(null);

  const [mode, setMode] = useState<CreationMode>("upload");
  const [metadata, setMetadata] = useState<DocumentMetadataFieldsValue>(EMPTY_METADATA_FIELDS);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pickedFile, setPickedFile] = useState<File | null>(null);

  // FASE 19b --- la lettura parte appena scegli il file, non quando
  // premi Salva: così avviene mentre compili tag e note, e quando arrivi
  // in fondo al form ha già finito. Stesso lavoro, ma dentro il tempo
  // che stavi già spendendo.
  const [reading, setReading] = useState<ReadingState>({ status: "idle" });
  const [title, setTitle] = useState("");
  /**
   * Cosa ha messo Hinthial, per poterlo dire accanto al campo. Il segno
   * sparisce appena l'utente tocca quel campo: da quel momento il valore
   * è suo, e continuare a chiamarlo "suggerito" sarebbe falso.
   */
  const [suggested, setSuggested] = useState<Suggested>({});
  // Identifica il file per cui è in corso la lettura: se ne scegli un
  // altro mentre la prima non è finita, il risultato vecchio non deve
  // arrivare dopo e sovrascrivere quello nuovo.
  const readingTokenRef = useRef(0);
  // La lettura in corso, per poterla aspettare al salvataggio se non ha
  // ancora finito (v. extractionForSave).
  const readingPromiseRef = useRef<Promise<PriorExtraction> | null>(null);
  const [recordedFile, setRecordedFile] = useState<File | null>(null);
  const [noteTitle, setNoteTitle] = useState("");
  const [noteBody, setNoteBody] = useState("");

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
    // Cambiare modo azzera anche ciò che Hinthial aveva ricavato dal
    // file precedente: una lettura in corso non deve arrivare dopo e
    // riempire i campi di una nota scritta a mano.
    readingTokenRef.current++;
    setReading({ status: "idle" });
    setTitle("");
    setSuggested({});
    setMetadata(EMPTY_METADATA_FIELDS);
  }

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setPickedFile(file);
    // Non si azzerano titolo/categoria/bene/fascicolo/tag/note: vale la
    // stessa regola della FASE 19b, "non si tocca ciò che è già
    // compilato". Scegliere una categoria e SOLO DOPO il file --- un
    // ordine perfettamente naturale --- perderebbe la scelta se qui si
    // ripartisse da campi vuoti. `applySuggestions` più sotto già si
    // guarda bene dal sovrascrivere un valore non vuoto (v. il merge con
    // `prev`): l'unica cosa che qui deve ripartire da capo è il segno
    // "suggerito da Hinthial", legato al file precedente.
    setSuggested({});
    if (file) {
      readingPromiseRef.current = readPickedFile(file);
    } else {
      readingPromiseRef.current = null;
      setReading({ status: "idle" });
    }
  }

  /**
   * FASE 19b --- legge il file appena scelto e ne precompila il form.
   *
   * Precompila invece di chiedere (come fa invece la scheda di un
   * contenuto già archiviato, v. ProposalsSection): qui non c'è ancora
   * niente di tuo da sovrascrivere, e stai già rivedendo un form riga
   * per riga --- vedere il valore e premere Salva **è** il consenso. Su
   * un documento già in archivio invece la categoria potresti averla
   * scelta tu mesi fa, e cambiarla senza chiedere sarebbe scorretto.
   */
  async function readPickedFile(file: File): Promise<PriorExtraction> {
    const token = ++readingTokenRef.current;
    const mimeType = file.type || "application/octet-stream";

    if (!canExtractText(mimeType)) {
      setReading({ status: "skipped" });
      // Niente testo da leggere: resta il nome del file, che è l'unico
      // indizio disponibile (ed è come funzionava prima della FASE 17).
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

      // Un altro file è stato scelto nel frattempo: questo risultato è
      // vecchio e non deve toccare niente. Si restituisce lo stesso ---
      // nessuno aspetta più questa promessa (v. readingPromiseRef).
      if (token === readingTokenRef.current) {
        const fields = text ? extractStructuredFields(text) : [];
        setReading({ status: "done", text, fields });
        applySuggestions(file, text ?? "", fields);
      }

      return { text, attempted: true };
    } catch {
      // Leggere è un di più: un file illeggibile non deve impedire di
      // salvarlo (v. domain/extraction/extract-text.ts).
      if (token === readingTokenRef.current) setReading({ status: "done", text: null, fields: [] });
      return { text: null, attempted: false };
    }
  }

  /** Riempie i campi che Hinthial è riuscito a ricavare, e se lo segna. */
  function applySuggestions(file: File, text: string, fields: StructuredField[]) {
    const next: Suggested = {};

    // Il titolo si **propone**, non si precompila --- unica eccezione tra
    // i campi qui sotto, e per una ragione precisa: categoria, bene e
    // scadenza sono vuoti, e riempirli non toglie niente a nessuno. Un
    // nome invece c'è sempre, ed è quello che il file si porta dietro:
    // sostituirlo d'ufficio violerebbe la stessa regola che governa le
    // proposte sulla scheda --- non si tocca ciò che è già compilato. In
    // più il nome è l'identità del documento, e un titolo sbagliato
    // messo in silenzio si nota molto dopo.
    const proposedTitle = fields.find((f) => f.kind === "title")?.value;
    if (proposedTitle) {
      // L'estensione si conserva: il titolo diventa il nome con cui il
      // file verrà scaricato, e senza estensione il sistema operativo
      // non saprebbe più con cosa aprirlo.
      const extension = file.name.includes(".") ? file.name.slice(file.name.lastIndexOf(".")) : "";
      next.title = `${proposedTitle}${extension}`;
    }

    // Il bene ha la precedenza sulle parole chiave: se il documento cita
    // una targa o un numero di polizza, quello non è un indizio, è una
    // certezza --- e porta con sé anche la categoria giusta.
    const asset = suggestAssetFromText(text, assets);
    const categoryId = asset?.categoryId
      ? asset.categoryId
      : heuristicCategorizer.suggestCategoryFromContent(file.name, text, categories);

    if (categoryId) {
      next.categoryId = categoryId;
      if (asset && asset.categoryId === categoryId) next.relatedAssetId = asset.id;
    }

    const expiry = fields.find((f) => f.kind === "expiry")?.value;
    if (expiry) next.expiresAt = expiry;

    setSuggested(next);
    setMetadata((prev) => ({
      ...prev,
      categoryId: next.categoryId ?? prev.categoryId,
      relatedAssetId: next.relatedAssetId ?? prev.relatedAssetId,
      expiresAt: next.expiresAt ?? prev.expiresAt,
    }));
  }

  // "📷 Scatta foto" apre la stessa (unica) casella di scelta file, ma
  // con `capture` impostato un istante prima --- sui dispositivi che lo
  // supportano (smartphone) questo apre direttamente la fotocamera
  // invece della libreria file; sugli altri l'attributo è ignorato e si
  // apre la normale finestra di scelta, senza effetti negativi. Un solo
  // <input type="file"> nel DOM (non uno in più accanto) --- così gli
  // e2e che lo trovano con il selettore generico non ne trovano due.
  function handleCameraClick() {
    const input = fileInputRef.current;
    if (!input) return;
    input.setAttribute("accept", "image/*");
    input.setAttribute("capture", "environment");
    input.click();
  }

  // Ripristina la casella al comportamento normale una volta chiusa la
  // finestra di scelta (con o senza foto scattata) --- altrimenti un
  // click successivo sulla casella stessa (non sul tasto qui sopra)
  // continuerebbe ad aprire la sola fotocamera.
  function handleFileInputBlur(event: React.FocusEvent<HTMLInputElement>) {
    event.target.removeAttribute("accept");
    event.target.removeAttribute("capture");
  }

  /**
   * Il risultato della lettura da consegnare al salvataggio.
   *
   * Se non ha ancora finito **si aspetta**, e vale la pena dire perché
   * non è in contraddizione con "caricare non deve rallentare". La
   * lettura è cominciata quando hai scelto il file, non adesso: l'attesa
   * qui è al massimo quella che c'era prima della FASE 19b, e quasi
   * sempre è già finita mentre compilavi il resto. Salvare senza
   * aspettare, invece, farebbe nascere il documento non cercabile per il
   * suo contenuto --- un peggioramento vero, in cambio di un secondo.
   */
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
        dossierId: metadata.dossierId || null,
        expiresAt: metadata.expiresAt || null,
        notes: metadata.notes,
        tags: parseTagsInput(metadata.tagsInput),
      };

      if (mode === "note") {
        await createTextNote(
          supabase,
          masterKey,
          user.id,
          { title: noteTitle.trim(), body: noteBody },
          metadataInput,
        );
      } else {
        const file = mode === "record" ? recordedFile! : pickedFile!;
        await uploadDocument(supabase, masterKey, user.id, file, metadataInput, {
          title: mode === "upload" ? title : undefined,
          // Il file registrato al momento non passa dalla lettura del
          // form: lo legge uploadDocument come ha sempre fatto.
          extraction: mode === "upload" ? await extractionForSave() : undefined,
          onPhase: (nextPhase, progress) => {
            setPhase(nextPhase);
            setReadProgress(progress);
          },
        });
      }

      router.push("/archive?created=1");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossibile aggiungere il contenuto.");
      setCreating(false);
    }
  }

  // Il file in gioco, qualunque sia il modo con cui è arrivato --- serve
  // solo per parlare all'utente del contenuto giusto ("l'immagine" e non
  // "il documento", v. sotto).
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

  return (
    <div className="flex flex-col gap-6">
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
          Documenti, immagini, audio, video o una nota scritta al momento --- tutto cifrato sul
          tuo dispositivo prima di essere salvato.
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Caricamento…</p>
      ) : (
        <form
          onSubmit={handleCreate}
          className="flex flex-col gap-4 rounded-2xl border border-zinc-200 bg-white shadow-[0_8px_20px_rgba(16,24,40,0.04)] p-4 dark:border-zinc-800 dark:bg-zinc-950"
        >
          <div role="radiogroup" aria-label="Tipo di contenuto" className="flex flex-wrap gap-2">
            {(Object.keys(MODE_LABEL) as CreationMode[]).map((option) => (
              <button
                key={option}
                type="button"
                role="radio"
                aria-checked={mode === option}
                onClick={() => handleModeChange(option)}
                className={
                  mode === option
                    ? "rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-white"
                    : "rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
                }
              >
                {MODE_LABEL[option]}
              </button>
            ))}
          </div>

          {mode === "upload" ? (
            <div className="flex flex-col gap-1">
              <label htmlFor="file" className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                File
              </label>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  id="file"
                  ref={fileInputRef}
                  type="file"
                  onChange={handleFileChange}
                  onBlur={handleFileInputBlur}
                  className="text-sm text-zinc-700 dark:text-zinc-300"
                />
                {/* Solo su smartphone --- su desktop l'attributo capture
                    non ha effetto, e il tasto sarebbe solo un secondo
                    modo ridondante di aprire lo stesso file picker. */}
                <button
                  type="button"
                  onClick={handleCameraClick}
                  className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100 md:hidden dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
                >
                  📷 Scatta foto
                </button>
              </div>

              {/* FASE 19b --- l'esito della lettura, appena scelto il
                  file. In creazione basta un riassunto: il testo per
                  intero vive sulla scheda del contenuto, dove si va
                  quando si vuole verificare davvero. Qui un muro di
                  ottomila caratteri renderebbe pesante il gesto più
                  frequente dell'app. */}
              {pickedFile ? <ReadingReport reading={reading} /> : null}
            </div>
          ) : mode === "record" ? (
            <AudioVideoRecorder
              onRecorded={setRecordedFile}
              title="Registra un audio o un video"
              description="Resta in memoria finché non salvi il contenuto qui sotto."
              confirmLabel="Usa questa registrazione"
            />
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

          {mode === "record" && recordedFile ? (
            <p className="text-sm text-zinc-700 dark:text-zinc-300">
              🎬 Pronta: {recordedFile.name}
            </p>
          ) : null}

          {/* FASE 17c --- l'OCR di una foto richiede qualche decina di
              secondi, e la prima volta scarica anche il motore: detto
              prima è un'attesa annunciata, scoperto dopo è un'app
              lenta. */}
          {isImage && !creating ? (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Hinthial leggerà il testo scritto dentro l&apos;immagine, sul tuo dispositivo, per
              renderlo cercabile. Può richiedere qualche decina di secondi.
            </p>
          ) : null}

          {/* FASE 19b --- il nome con cui il contenuto vivrà in archivio.
              "scan_0012.pdf" e "IMG_4821.jpg" sono la gran parte di un
              archivio vero, e sono il motivo per cui poi non si ritrova
              niente. */}
          {mode === "upload" && pickedFile ? (
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

          <DocumentMetadataFields
            idPrefix="upload"
            categories={categories}
            assets={assets}
            dossiers={dossiers}
            value={metadata}
            onChange={setMetadata}
            // La scadenza si chiede solo per i file, ed è nuovo: prima
            // era nascosta perché in creazione non la si conosceva quasi
            // mai. Ora Hinthial la trova dentro il documento.
            showExpiry={mode === "upload"}
            hints={{
              categoryId:
                suggested.categoryId && metadata.categoryId === suggested.categoryId ? (
                  <SuggestedHint>Suggerita da Hinthial</SuggestedHint>
                ) : null,
              relatedAssetId:
                suggested.relatedAssetId && metadata.relatedAssetId === suggested.relatedAssetId ? (
                  <SuggestedHint>Riconosciuto nel documento</SuggestedHint>
                ) : null,
              expiresAt: <ExpiryHint metadata={metadata} suggested={suggested} reading={reading} />,
            }}
          />

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
              {creating
                ? phase === "reading"
                  ? readingLabel()
                  : "Salvataggio…"
                : "Aggiungi all'archivio"}
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
