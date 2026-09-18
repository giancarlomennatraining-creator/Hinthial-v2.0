"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/db/supabase/client";
import { bytesToUtf8 } from "@/lib/crypto";
import {
  deleteDocument,
  downloadDocument,
  extractTextForExistingDocument,
  listDocuments,
} from "@/domain/documents/repository";
import { listAssets } from "@/domain/assets/repository";
import { listCategories } from "@/domain/categories/repository";
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

/**
 * FASE 17e --- la scheda di un contenuto d'Archivio: la sua casa.
 *
 * Nasce per rispondere a una domanda che fino a ieri non aveva uno
 * schermo dove essere posta: **cosa ha letto Hinthial dentro questo
 * file?** L'estrazione esiste dalla FASE 17, ma la sua unica traccia
 * visibile era uno spezzone di una riga nei risultati di ricerca, e solo
 * se si indovinava la parola giusta. In un prodotto che promette "niente
 * esce dal tuo dispositivo", far vedere esattamente cosa si è letto non
 * è un di più: è la dimostrazione della promessa.
 *
 * È anche il pavimento delle fasi successive --- i campi estratti (18),
 * le proposte (19), il fascicolo (20), il consenso per singolo contenuto
 * (22) atterrano tutti qui. Di proposito **non** ci sono sezioni vuote
 * in attesa di quelle fasi: una pagina piena di riquadri "in arrivo"
 * sembra quasi finita e non lo è.
 */
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Anteprima: object URL per immagini/audio/video e per la prima pagina
  // disegnata di un PDF, testo per le note.
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [noteBody, setNoteBody] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  /** Pagine del PDF, per dire "prima di N" --- null se non è un PDF. */
  const [pdfPageCount, setPdfPageCount] = useState<number | null>(null);
  /** Un PDF che pdf.js non è riuscito a disegnare: si ripiega sul messaggio. */
  const [previewUnavailable, setPreviewUnavailable] = useState(false);

  // Rilettura di questo singolo contenuto (v. handleReread).
  const [rereading, setRereading] = useState<number | null>(null);

  // FASE 19 --- proposte, rifiuti già espressi e l'ultima azione
  // annullabile. L'annullamento vale per la permanenza sulla pagina: chi
  // se ne accorge dopo può sempre correggere dalla scheda, che è dove
  // quel valore vive.
  const [rejections, setRejections] = useState<ProposalRejection[]>([]);
  const [undoable, setUndoable] = useState<UndoableAction | null>(null);
  const [proposalBusy, setProposalBusy] = useState(false);

  // Il testo letto può essere lungo: se ne mostra un pezzo e si apre a
  // richiesta. Aprirlo tutto sempre farebbe scorrere la pagina per
  // minuti su un contratto di trenta pagine.
  const [fullText, setFullText] = useState(false);

  // Stesso contatore di richieste di EditArchiveItemForm --- v. lì il
  // perché (StrictMode invoca l'effetto due volte al mount).
  const latestRequestRef = useRef(0);

  const refresh = useCallback(async () => {
    const requestId = ++latestRequestRef.current;
    setError(null);
    try {
      const [documents, assetsResult, categoriesResult, rejectionsResult] = await Promise.all([
        listDocuments(supabase, masterKey),
        listAssets(supabase, masterKey),
        listCategories(supabase),
        listProposalRejections(supabase, masterKey, documentId),
      ]);
      if (requestId !== latestRequestRef.current) return;
      setDoc(documents.find((d) => d.id === documentId) ?? null);
      setAssets(assetsResult);
      setCategories(categoriesResult);
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

  // Immagine, nota e PDF si aprono da soli: sono il contenuto stesso, ed
  // è il motivo per cui si è arrivati qui. Audio e video no --- possono
  // pesare decine di megabyte, e si scaricano solo se li si vuole
  // davvero sentire.
  const autoPreview = kind === "image" || kind === "note" || isPdf;

  const loadPreview = useCallback(async () => {
    if (!doc) return;
    setPreviewLoading(true);
    setError(null);
    try {
      const { mimeType, bytes } = await downloadDocument(supabase, masterKey, doc);

      if (contentKindFor(mimeType) === "note") {
        setNoteBody(bytesToUtf8(bytes));
        return;
      }

      if (mimeType === "application/pdf") {
        // Un PDF non si può mostrare com'è: se ne disegna la prima
        // pagina, con lo stesso pdf.js che l'OCR usa per leggerle (v.
        // lib/pdf.ts). Vale sia per i PDF nativi sia per le scansioni.
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

  /**
   * Rilegge questo contenuto da zero. Serve in tre casi reali: l'OCR ha
   * sbagliato e si vuole riprovare; il contenuto è stato caricato prima
   * che Hinthial sapesse leggerlo; è stato letto da una versione
   * precedente (quelli letti prima della FASE 17e, per esempio, non
   * conservavano l'impaginazione --- rileggerli la recupera).
   */
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

  /**
   * FASE 19 --- ogni azione su una proposta passa di qui: esegue,
   * ricarica, e lascia pronta la strada per tornare indietro. Il
   * `currentUserId()` serve perché l'audit registra a nome di chi.
   */
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
      const accepted = await acceptProposal(supabase, ownerId, doc, proposal.kind, value);
      return {
        message:
          proposal.kind === "expiry"
            ? `Scadenza impostata al ${formatDate(value)}.`
            : "Categoria impostata.",
        onUndo: () =>
          void runProposalAction(async (undoOwnerId) => {
            await undoAcceptance(supabase, undoOwnerId, doc.id, accepted);
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
  const reading = readingStateFor(doc);
  // FASE 18 --- calcolati al volo dal testo già decifrato in memoria, non
  // salvati: non c'è niente da migrare, valgono da subito su tutto
  // l'archivio esistente, e non esiste proprio il modo di scrivere per
  // sbaglio qualcosa che l'utente non ha accettato (v. FASE 19).
  // FASE 19 --- che cosa c'è da proporre, tolto ciò che è già impostato e
  // ciò che l'utente ha già scartato (v. domain/proposals/build.ts).
  const proposals = buildProposals(doc, categories, rejections);

  // "Cosa ne ho ricavato" dice ciò che Hinthial ha capito e che **non si
  // legge già da un'altra parte della stessa schermata**. Tre esclusioni,
  // e tutte e tre saltano all'occhio ora che il riquadro sta accanto alla
  // scheda invece che in fondo alla pagina:
  //
  // - ciò che è già una proposta (lo stesso valore, con la stessa fonte,
  //   a due centimetri di distanza --- e la copia senza tasti sembrerebbe
  //   pure un'altra cosa);
  // - ciò che è già nella scheda (una scadenza impostata non è più una
  //   notizia: è un dato del documento, ed è scritto qui sopra);
  // - il titolo, che da questa pagina non si può applicare: un
  //   suggerimento su cui non si può agire è solo un invito a chiedersi
  //   "e allora?". Vive dov'è utile, cioè al caricamento (v. FASE 19b).
  const structuredFields = extractStructuredFields(doc.extractedText).filter((field) => {
    if (field.kind === "title") return false;
    if (proposals.some((p) => p.kind === field.kind && p.value === field.value)) return false;
    if (field.kind === "expiry" && doc.expiresAt?.slice(0, 10) === field.value) return false;
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

      {/* Anteprima e scheda affiancate, un terzo e due terzi (v. richiesta
          utente). Container query e non breakpoint di viewport: la
          larghezza vera qui dipende anche dalla barra laterale, aperta o
          chiusa --- stesso motivo per cui le tabelle nascondono le colonne
          a container query. Sotto i ~768px di spazio reale si impilano,
          perché un terzo di poco è una colonna illeggibile. */}
      <div className="@container">
        {/* items-start: senza, la griglia allunga la scheda fino
            all'altezza dell'anteprima, e per un contenuto senza categoria
            né tag resterebbe mezzo riquadro vuoto. Ogni blocco è alto
            quanto ciò che contiene. */}
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

          {/* Colonna di destra: la scheda e, sotto, ciò che Hinthial ha
              ricavato (v. richiesta utente). Stanno insieme perché sono
              la stessa cosa vista da due parti --- quello che il
              documento è, e quello che il documento dice. */}
          <div className="flex flex-col gap-6 @3xl:col-span-2">
            <section aria-label="Scheda" className="flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-white shadow-[0_8px_20px_rgba(16,24,40,0.04)] p-4 dark:border-zinc-800 dark:bg-zinc-950">
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Scheda</h2>
              <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[10rem_1fr]">
                <Field label="Categoria">
                  {category ? `${category.icon} ${category.name}` : "—"}
                </Field>
                <Field label="Bene collegato">{asset ? asset.name : "—"}</Field>
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

            {/* FASE 18 --- accanto alla scheda e non sotto al testo grezzo:
                sono le stesse informazioni della scheda, solo ricavate da
                Hinthial invece che scritte dall'utente. */}
            <StructuredFieldsSection fields={structuredFields} />
          </div>
        </div>
      </div>

      {/* FASE 19 --- a tutta larghezza e prima del testo: è l'unica parte
          che chiede una risposta, e una domanda stretta in una colonna,
          in fondo alla pagina, è una domanda che nessuno vede. */}
      <ProposalsSection
        proposals={proposals}
        categories={categories}
        busy={proposalBusy}
        undoable={undoable}
        onAccept={handleAcceptProposal}
        onReject={handleRejectProposal}
      />

      {/* A tutta larghezza, sotto: è il testo di un documento, e in una
          colonna stretta si leggerebbe peggio di quanto si legga il
          documento stesso. */}
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

/**
 * "Cosa ho letto" --- il cuore della pagina, e l'unico posto in cui i
 * quattro stati di lettura (v. domain/extraction/reading-state.ts)
 * diventano qualcosa che si può leggere invece che dedurre.
 *
 * È anche dove trova finalmente casa l'avviso che nella FASE 17b avevo
 * deliberatamente **non** messo nell'elenco: là sarebbe stato un cartello
 * addosso a documenti di cui nessuno aveva chiesto niente, qui è la
 * risposta a una domanda che l'utente ha appena fatto aprendo la scheda.
 */
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
  // Per una nota il testo È il contenuto: l'anteprima qui sopra lo mostra
  // già per intero, e una seconda copia sarebbe solo una ripetizione.
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
