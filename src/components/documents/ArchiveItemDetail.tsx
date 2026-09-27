"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/db/supabase/client";
import { bytesToUtf8 } from "@/lib/crypto";
import {
  deleteDocument,
  downloadDocument,
  downloadThumbnail,
  extractTextForExistingDocument,
  listDocuments,
} from "@/domain/documents/repository";
import { listAssets } from "@/domain/assets/repository";
import { listCategories } from "@/domain/categories/repository";
import { listDossiers } from "@/domain/dossiers/repository";
import type { DossierListItem } from "@/domain/dossiers/types";
import { readingStateFor } from "@/domain/extraction/reading-state";
import { extractStructuredFields } from "@/domain/extraction/structured-fields";
import { buildProposals } from "@/domain/proposals/build";
import {
  acceptProposal,
  listProposalRejections,
  rejectProposal,
  undoAcceptance,
  undoRejection,
} from "@/domain/proposals/repository";
import { StructuredFieldsSection } from "@/components/documents/StructuredFieldsSection";
import {
  ProposalsSection,
  type UndoableAction,
} from "@/components/documents/ProposalsSection";
import type { Proposal, ProposalRejection } from "@/domain/proposals/types";
import {
  contentKindFor,
  CONTENT_KIND_ICON,
  CONTENT_KIND_LABEL,
  hasInlinePlayer,
} from "@/lib/content-kind";
import { saveBytesAsFile } from "@/lib/download";
import { formatDate, formatSize } from "@/lib/format";
import { renderPdfFirstPage } from "@/lib/pdf";
import { useToast } from "@/components/ui/ToastProvider";
import type { DocumentListItem } from "@/domain/documents/types";
import type { AssetListItem } from "@/domain/assets/types";
import type { Category } from "@/domain/categories/types";

/** Scheda di un contenuto d'Archivio: mostra anche cosa Hinthial ha estratto dal file, a dimostrazione che resta sul dispositivo. Niente sezioni vuote per fasi future --- sembrerebbero quasi finite e non lo sono. */
export function ArchiveItemDetail({
  masterKey,
  documentId,
}: {
  masterKey: CryptoKey;
  documentId: string;
}) {
  const supabase = useRef(createClient()).current;
  const router = useRouter();
  const showToast = useToast();

  const [doc, setDoc] = useState<DocumentListItem | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [assets, setAssets] = useState<AssetListItem[]>([]);
  const [dossiers, setDossiers] = useState<DossierListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Anteprima: object URL per immagini/audio/video e per la prima pagina disegnata di un PDF, testo per le note.
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [noteBody, setNoteBody] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  /** Pagine del PDF per "prima di N" --- null se non è un PDF o se l'anteprima viene dalla miniatura. */
  const [pdfPageCount, setPdfPageCount] = useState<number | null>(null);
  /** Un PDF che pdf.js non è riuscito a disegnare: si ripiega sul messaggio. */
  const [previewUnavailable, setPreviewUnavailable] = useState(false);
  /** Vero quando `previewUrl` viene dalla miniatura: non porta il numero di pagine, quindi niente "Prima pagina di N". */
  const [previewIsThumbnail, setPreviewIsThumbnail] = useState(false);

  const [rereading, setRereading] = useState<number | null>(null);

  // Proposte, rifiuti già espressi e ultima azione annullabile.
  const [rejections, setRejections] = useState<ProposalRejection[]>([]);
  const [undoable, setUndoable] = useState<UndoableAction | null>(null);
  const [proposalBusy, setProposalBusy] = useState(false);

  // Testo letto potenzialmente lungo: se ne mostra un pezzo, il resto solo a richiesta.
  const [fullText, setFullText] = useState(false);

  // Contatore di richieste --- v. EditArchiveItemForm (StrictMode invoca l'effetto due volte al mount).
  const latestRequestRef = useRef(0);

  const refresh = useCallback(async () => {
    const requestId = ++latestRequestRef.current;
    setError(null);
    try {
      const [documents, assetsResult, categoriesResult, dossiersResult, rejectionsResult] =
        await Promise.all([
          listDocuments(supabase, masterKey),
          listAssets(supabase, masterKey),
          listCategories(supabase),
          listDossiers(supabase, masterKey),
          listProposalRejections(supabase, masterKey, documentId),
        ]);
      if (requestId !== latestRequestRef.current) return;
      setDoc(documents.find((d) => d.id === documentId) ?? null);
      setAssets(assetsResult);
      setCategories(categoriesResult);
      setDossiers(dossiersResult);
      setRejections(rejectionsResult);
    } catch (err) {
      if (requestId !== latestRequestRef.current) return;
      setError(err instanceof Error ? err.message : "Impossibile caricare il contenuto.");
    } finally {
      if (requestId === latestRequestRef.current) setLoading(false);
    }
  }, [supabase, masterKey, documentId]);

  useEffect(() => {
    // See DocumentsPanel.tsx for why fetch-on-mount is legitimate here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
  }, [refresh]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const kind = doc ? contentKindFor(doc.mimeType) : null;

  const isPdf = doc?.mimeType === "application/pdf";

  // Immagine, nota e PDF si aprono da soli: audio e video no, possono pesare decine di megabyte.
  const autoPreview = kind === "image" || kind === "note" || isPdf;

  const loadPreview = useCallback(async () => {
    if (!doc) return;
    setPreviewLoading(true);
    setError(null);
    try {
      if (contentKindFor(doc.mimeType) === "note") {
        const { bytes } = await downloadDocument(supabase, masterKey, doc);
        setNoteBody(bytesToUtf8(bytes));
        return;
      }

      if (doc.mimeType === "application/pdf" || doc.mimeType.startsWith("image/")) {
        // La miniatura evita di scaricare il file intero solo per l'anteprima (v. lib/thumbnail.ts).
        const thumbnail = await downloadThumbnail(supabase, masterKey, doc);
        if (thumbnail) {
          setPreviewUrl(URL.createObjectURL(thumbnail));
          setPreviewIsThumbnail(true);
          return;
        }
      }

      // Nessuna miniatura (tipo non supportato o non generata a suo tempo): si scarica il file intero.
      const { mimeType, bytes } = await downloadDocument(supabase, masterKey, doc);

      if (mimeType === "application/pdf") {
        // Se ne disegna la prima pagina con lo stesso pdf.js che l'OCR usa per leggerle (v. lib/pdf.ts).
        const rendered = await renderPdfFirstPage(bytes);
        if (!rendered) {
          setPreviewUnavailable(true);
          return;
        }
        setPdfPageCount(rendered.pageCount);
        setPreviewUrl(URL.createObjectURL(rendered.image));
        return;
      }

      setPreviewUrl(URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: mimeType })));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossibile aprire il contenuto.");
      setPreviewUnavailable(true);
    } finally {
      setPreviewLoading(false);
    }
  }, [supabase, masterKey, doc]);

  useEffect(() => {
    if (!doc || !autoPreview) return;
    if (previewUrl || noteBody !== null || previewLoading || previewUnavailable) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadPreview();
  }, [doc, autoPreview, previewUrl, noteBody, previewLoading, previewUnavailable, loadPreview]);

  async function handleDownload() {
    if (!doc) return;
    setBusy(true);
    setError(null);
    try {
      const { filename, mimeType, bytes } = await downloadDocument(supabase, masterKey, doc);
      saveBytesAsFile(bytes, filename, mimeType);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossibile aprire il contenuto.");
    } finally {
      setBusy(false);
    }
  }

  /** Rilegge da zero: l'OCR ha sbagliato, il contenuto è stato caricato prima che si sapesse leggerlo, o è stato letto da una versione precedente che non conservava l'impaginazione. */
  async function handleReread() {
    if (!doc) return;
    setRereading(0);
    setError(null);
    try {
      const { foundText } = await extractTextForExistingDocument(
        supabase,
        masterKey,
        doc,
        (fraction) => setRereading(fraction),
      );
      await refresh();
      showToast(
        foundText ? "Lettura completata." : "L'ho guardato, ma non ci ho trovato testo.",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossibile rileggere il contenuto.");
    } finally {
      setRereading(null);
    }
  }

  /** Ogni azione su una proposta passa di qui: esegue, ricarica, lascia pronto l'annullamento. L'id utente serve perché l'audit registra a nome di chi. */
  async function runProposalAction(
    action: (ownerId: string) => Promise<UndoableAction>,
  ): Promise<void> {
    setProposalBusy(true);
    setError(null);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Devi essere autenticato.");

      const next = await action(user.id);
      await refresh();
      setUndoable(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossibile applicare la proposta.");
    } finally {
      setProposalBusy(false);
    }
  }

  function handleAcceptProposal(proposal: Proposal, value: string) {
    if (!doc) return;
    void runProposalAction(async (ownerId) => {
      const accepted = await acceptProposal(supabase, masterKey, ownerId, doc, proposal.kind, value);
      return {
        message:
          proposal.kind === "expiry"
            ? `Scadenza impostata al ${formatDate(value)}.`
            : proposal.kind === "issuer"
              ? "Emittente impostato."
              : "Categoria impostata.",
        onUndo: () =>
          void runProposalAction(async (undoOwnerId) => {
            await undoAcceptance(supabase, masterKey, undoOwnerId, doc.id, accepted);
            return { message: "Annullato.", onUndo: () => setUndoable(null) };
          }),
      };
    });
  }

  function handleRejectProposal(proposal: Proposal) {
    if (!doc) return;
    void runProposalAction(async (ownerId) => {
      const rejectionId = await rejectProposal(supabase, masterKey, ownerId, doc.id, proposal);
      return {
        message: "Non te lo richiederò più.",
        onUndo: () =>
          void runProposalAction(async (undoOwnerId) => {
            await undoRejection(supabase, undoOwnerId, rejectionId);
            return { message: "Annullato.", onUndo: () => setUndoable(null) };
          }),
      };
    });
  }

  async function handleDelete() {
    if (!doc) return;
    if (!window.confirm(`Eliminare "${doc.filename}"? L'operazione non è reversibile.`)) return;

    setBusy(true);
    setError(null);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Devi essere autenticato.");
      await deleteDocument(supabase, user.id, doc);
      router.push("/archive");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossibile eliminare il contenuto.");
      setBusy(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-zinc-500 dark:text-zinc-400">Caricamento…</p>;
  }

  if (!doc || !kind) {
    return (
      <div className="flex flex-col gap-4">
        <Link
          href="/archive"
          className="text-sm font-medium text-zinc-500 underline-offset-2 hover:underline dark:text-zinc-400"
        >
          ← Torna all&apos;archivio
        </Link>
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          Contenuto non trovato.
        </p>
      </div>
    );
  }

  const category = categories.find((c) => c.id === doc.categoryId);
  const asset = assets.find((a) => a.id === doc.relatedAssetId);
  const linkedDossiers = dossiers.filter((d) => doc.dossierIds.includes(d.id));
  const reading = readingStateFor(doc);
  // Calcolati al volo dal testo già decifrato, non salvati: niente da migrare, valgono su tutto l'archivio esistente.
  // Che cosa c'è da proporre, tolto ciò che è già impostato e ciò che l'utente ha già scartato (v. domain/proposals/build.ts).
  const proposals = buildProposals(doc, categories, rejections);

  // "Cosa ne ho ricavato" esclude: ciò che è già una proposta identica, ciò che è già nella scheda (non più una
  // notizia), e il titolo (non applicabile da questa pagina --- vive al caricamento, v. FASE 19b).
  const structuredFields = extractStructuredFields(doc.extractedText).filter((field) => {
    if (field.kind === "title") return false;
    if (proposals.some((p) => p.kind === field.kind && p.value === field.value)) return false;
    if (field.kind === "expiry" && doc.expiresAt?.slice(0, 10) === field.value) return false;
    if (field.kind === "issuer" && doc.issuer === field.value) return false;
    return true;
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/archive"
          className="text-sm font-medium text-zinc-500 underline-offset-2 hover:underline dark:text-zinc-400"
        >
          ← Torna all&apos;archivio
        </Link>
        <h1 className="mt-2 flex min-w-0 items-start gap-2 text-2xl font-semibold tracking-tight text-brand">
          <span aria-hidden="true">{CONTENT_KIND_ICON[kind]}</span>
          <span className="min-w-0 break-words">{doc.filename}</span>
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          {CONTENT_KIND_LABEL[kind]} · {formatSize(doc.size)} · aggiunto il{" "}
          {formatDate(doc.createdAt)}
        </p>
      </div>

      {error ? (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <Link
          href={`/archive/${doc.id}/edit`}
          className="rounded-xl bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-hover"
        >
          Modifica
        </Link>
        {kind === "note" ? null : (
          <button
            type="button"
            disabled={busy}
            onClick={handleDownload}
            className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
          >
            Scarica
          </button>
        )}
        <button
          type="button"
          disabled={busy}
          onClick={handleDelete}
          className="rounded-md border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950"
        >
          Elimina
        </button>
      </div>

      {/* Anteprima e scheda affiancate, un terzo e due terzi. Container query (non breakpoint di viewport)
          perché la larghezza reale dipende anche dalla barra laterale, aperta o chiusa. */}
      <div className="@container">
        {/* items-start: senza, la griglia allungherebbe la scheda fino all'altezza dell'anteprima. */}
        <div className="grid items-start gap-6 @3xl:grid-cols-3">
          <section aria-label="Anteprima" className="flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-white shadow-[0_8px_20px_rgba(16,24,40,0.04)] p-4 @3xl:col-span-1 dark:border-zinc-800 dark:bg-zinc-950">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Anteprima</h2>
            {previewLoading ? (
              <p className="text-sm text-zinc-500 dark:text-zinc-400">Caricamento…</p>
            ) : kind === "note" ? (
              <p className="text-sm whitespace-pre-wrap text-zinc-700 dark:text-zinc-300">
                {noteBody || "(nota vuota)"}
              </p>
            ) : (kind === "image" || isPdf) && previewUrl ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element -- object URL locale, decifrata sul dispositivo */}
                <img
                  src={previewUrl}
                  alt={
                    isPdf ? `Prima pagina di ${doc.filename}` : doc.filename
                  }
                  className="max-h-[32rem] max-w-full self-start rounded-md border border-zinc-200 dark:border-zinc-800"
                />
                {isPdf && pdfPageCount !== null ? (
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    {pdfPageCount === 1
                      ? "Pagina unica."
                      : `Prima pagina di ${pdfPageCount}.`}{" "}
                    Usa &laquo;Scarica&raquo; per sfogliarlo tutto.
                  </p>
                ) : previewIsThumbnail ? (
                  // La miniatura non porta il numero di pagine: didascalia più generica.
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    Anteprima. Usa &laquo;Scarica&raquo; per l&apos;originale
                    {isPdf ? ", pagina per pagina" : ""}.
                  </p>
                ) : null}
              </>
            ) : hasInlinePlayer(kind) && previewUrl ? (
              kind === "video" ? (
                <video src={previewUrl} controls className="max-h-[32rem] max-w-full rounded-md" />
              ) : (
                <audio src={previewUrl} controls className="w-full" />
              )
            ) : hasInlinePlayer(kind) ? (
              <button
                type="button"
                onClick={loadPreview}
                className="self-start rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
              >
                Riproduci
              </button>
            ) : (
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                {isPdf
                  ? "Non sono riuscito a disegnarne l'anteprima."
                  : `Un ${CONTENT_KIND_LABEL[kind].toLowerCase()} di questo tipo non si può sfogliare qui.`}{" "}
                Usa &laquo;Scarica&raquo; per aprirlo con il tuo programma.
              </p>
            )}
          </section>

          {/* Colonna di destra: la scheda e, sotto, ciò che Hinthial ha ricavato dal testo. */}
          <div className="flex flex-col gap-6 @3xl:col-span-2">
            <section aria-label="Scheda" className="flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-white shadow-[0_8px_20px_rgba(16,24,40,0.04)] p-4 dark:border-zinc-800 dark:bg-zinc-950">
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Scheda</h2>
              <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[10rem_1fr]">
                <Field label="Categoria">
                  {category ? `${category.icon} ${category.name}` : "—"}
                </Field>
                <Field label="Bene collegato">{asset ? asset.name : "—"}</Field>
                <Field label="Fascicoli">
                  {linkedDossiers.length > 0 ? (
                    <span className="flex flex-wrap gap-x-3 gap-y-1">
                      {linkedDossiers.map((dossier) => (
                        <Link
                          key={dossier.id}
                          href={`/dossiers/${dossier.id}`}
                          className="text-brand hover:underline"
                        >
                          {dossier.status === "closed" ? "🗂️ " : "📂 "}
                          {dossier.title}
                        </Link>
                      ))}
                    </span>
                  ) : (
                    "—"
                  )}
                </Field>
                <Field label="Scadenza">{doc.expiresAt ? formatDate(doc.expiresAt) : "—"}</Field>
                <Field label="Tag">
                  {doc.tags.length > 0 ? (
                    <span className="flex flex-wrap gap-1">
                      {doc.tags.map((tag) => (
                        <span
                          key={tag}
                          className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400"
                        >
                          {tag}
                        </span>
                      ))}
                    </span>
                  ) : (
                    "—"
                  )}
                </Field>
                <Field label="Note">
                  <span className="whitespace-pre-wrap">{doc.notes || "—"}</span>
                </Field>
              </dl>
            </section>

            <StructuredFieldsSection fields={structuredFields} />
          </div>
        </div>
      </div>

      {/* A tutta larghezza e prima del testo: è l'unica parte che chiede una risposta. */}
      <ProposalsSection
        proposals={proposals}
        categories={categories}
        busy={proposalBusy}
        undoable={undoable}
        onAccept={handleAcceptProposal}
        onReject={handleRejectProposal}
      />

      {/* A tutta larghezza, sotto: in una colonna stretta si leggerebbe peggio del documento stesso. */}
      <ReadingSection
        doc={doc}
        reading={reading}
        rereading={rereading}
        fullText={fullText}
        onToggleFullText={() => setFullText((v) => !v)}
        onReread={handleReread}
      />
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <dt className="text-zinc-500 dark:text-zinc-400">{label}</dt>
      <dd className="mb-1 text-zinc-900 sm:mb-0 dark:text-zinc-100">{children}</dd>
    </>
  );
}

/** Quanti caratteri del testo letto si mostrano prima di "Mostra tutto". */
const TEXT_PREVIEW_CHARS = 1200;

/** "Cosa ho letto" --- unico posto dove i quattro stati di lettura (v. domain/extraction/reading-state.ts) diventano leggibili invece che dedotti. */
function ReadingSection({
  doc,
  reading,
  rereading,
  fullText,
  onToggleFullText,
  onReread,
}: {
  doc: DocumentListItem;
  reading: ReturnType<typeof readingStateFor>;
  rereading: number | null;
  fullText: boolean;
  onToggleFullText: () => void;
  onReread: () => void;
}) {
  // Per una nota il testo È il contenuto: l'anteprima lo mostra già per intero.
  if (reading === "own-text") return null;

  const busy = rereading !== null;
  const rereadLabel = busy
    ? `Lettura… ${Math.round((rereading ?? 0) * 100)}%`
    : reading === "never"
      ? "Leggilo ora"
      : "Rileggi";

  const tooLong = doc.extractedText.length > TEXT_PREVIEW_CHARS;
  const shown =
    fullText || !tooLong ? doc.extractedText : doc.extractedText.slice(0, TEXT_PREVIEW_CHARS);

  return (
    <section aria-label="Cosa ho letto" className="flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-white shadow-[0_8px_20px_rgba(16,24,40,0.04)] p-4 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Cosa ho letto</h2>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">🔒 sul tuo dispositivo</p>
      </div>

      {reading === "cannot" ? (
        <>
          <p className="text-sm text-zinc-700 dark:text-zinc-300">
            Non so ancora ascoltare gli audio e i video. Nel frattempo puoi scrivere tu una
            trascrizione dall&apos;elenco dell&apos;Archivio, e la ricerca la userà.
          </p>
          {doc.transcript ? (
            <div className="rounded-md bg-zinc-50 p-3 dark:bg-zinc-900">
              <p className="mb-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">
                Trascrizione, scritta da te
              </p>
              <p className="text-sm whitespace-pre-wrap text-zinc-700 dark:text-zinc-300">
                {doc.transcript}
              </p>
            </div>
          ) : null}
        </>
      ) : reading === "never" ? (
        <p className="text-sm text-zinc-700 dark:text-zinc-300">
          Non l&apos;ho ancora letto: è arrivato in archivio prima che sapessi leggerne il
          contenuto. Finché non lo leggo, lo trovi solo per nome, tag e note.
        </p>
      ) : reading === "nothing" ? (
        <p className="text-sm text-zinc-700 dark:text-zinc-300">
          L&apos;ho guardato il {doc.extractedAt ? formatDate(doc.extractedAt) : "—"}, ma non ci ho
          trovato testo. Capita con le foto che non ne contengono, o quando la scrittura è troppo
          sfocata per esserne sicuro.
        </p>
      ) : (
        <>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Letto il {doc.extractedAt ? formatDate(doc.extractedAt) : "—"} ·{" "}
            {doc.extractedText.length.toLocaleString("it-IT")} caratteri
          </p>
          <p
            data-testid="extracted-text"
            className="max-h-96 overflow-y-auto rounded-md bg-zinc-50 p-3 text-sm whitespace-pre-wrap text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
          >
            {shown}
            {tooLong && !fullText ? "…" : ""}
          </p>
          {tooLong ? (
            <button
              type="button"
              onClick={onToggleFullText}
              className="self-start text-sm font-medium text-brand underline-offset-2 hover:underline"
            >
              {fullText ? "Mostra meno" : "Mostra tutto"}
            </button>
          ) : null}
        </>
      )}

      {reading === "cannot" ? null : (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-200 pt-3 dark:border-zinc-800">
          <p className="min-w-0 text-xs text-zinc-500 dark:text-zinc-400">
            Letto qui, sul tuo dispositivo: questo testo non è mai uscito. Serve a ritrovare il
            contenuto quando lo cerchi.
          </p>
          <button
            type="button"
            disabled={busy}
            onClick={onReread}
            className="shrink-0 rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
          >
            {rereadLabel}
          </button>
        </div>
      )}
    </section>
  );
}
