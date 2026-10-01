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
  saveAISynthesis,
  updateDocumentAIExtractionExclusion,
  updateDocumentMetadata,
} from "@/domain/documents/repository";
import { listAssets } from "@/domain/assets/repository";
import { listCategories, grantCategoryAIExtractionTemporarily } from "@/domain/categories/repository";
import { isCategoryEnabledForExtraction } from "@/domain/categories/ai-consent";
import { listFieldVocabulary, type FieldVocabularyEntry } from "@/domain/structured-fields/vocabulary";
import { inferFieldInputType } from "@/domain/structured-fields/value-type";
import { listDossiers } from "@/domain/dossiers/repository";
import type { DossierListItem } from "@/domain/dossiers/types";
import { readingStateFor } from "@/domain/extraction/reading-state";
import { extractStructuredFields } from "@/domain/extraction/structured-fields";
import { buildProposals } from "@/domain/proposals/build";
import {
  acceptProposal,
  type AcceptedProposal,
  listProposalRejections,
  rejectProposal,
  undoAcceptance,
  undoRejection,
} from "@/domain/proposals/repository";
import {
  analysisConfirmMessage,
  analyzeDocumentWithClaude,
  planAnalysis,
  buildAIProposals,
  type AIAnalysisScope,
  type AnalysisProgress,
  type AIExtractedFields,
} from "@/domain/ai/analyze-document";
import { useAIProcessingConsent } from "@/components/ai/AIProcessingConsentProvider";
import { StructuredFieldsSection } from "@/components/documents/StructuredFieldsSection";
import { ProposalsSection, type UndoableAction } from "@/components/documents/ProposalsSection";
import { AIAnalysisTrigger } from "@/components/documents/AIAnalysisTrigger";
import {
  DocumentMetadataFields,
  documentToFields,
  parseTagsInput,
  type DocumentMetadataFieldsValue,
} from "@/components/documents/DocumentMetadataFields";
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
 * Scheda di un contenuto d'Archivio --- fonde vista e modifica (v. feedback utente: due pagine separate creavano
 * confusione): niente più `/archive/[id]/edit`, i campi della Scheda sono sempre modificabili qui, un "Salva
 * modifiche" li mette via. Mostra anche cosa Hinthial ha estratto dal file, a dimostrazione che resta sul
 * dispositivo. Niente più tab "Proposte" a sé: quello che c'è da accettare/rifiutare vive dentro "Letto dal
 * dispositivo" (locale) o "Chiedi a Hinthia" (Claude), a seconda di dove viene. Niente sezioni vuote per fasi
 * future --- sembrerebbero quasi finite e non lo sono.
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
  const { masterEnabled, extractionConsent } = useAIProcessingConsent();

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

  // FASE 22: quello che Claude ha letto in questa sessione --- ricalcolato in proposte a ogni render come le
  // locali (v. buildAIProposals), così accettare/rifiutare le filtra allo stesso modo, automaticamente.
  const [aiFields, setAiFields] = useState<AIExtractedFields | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiProgress, setAiProgress] = useState<AnalysisProgress | null>(null);
  // Etichette dei campi eterogenei già registrati (v. domain/structured-fields) --- per mostrare "Numero polizza" e non la chiave grezza in Scheda.
  const [fieldVocabulary, setFieldVocabulary] = useState<FieldVocabularyEntry[]>([]);

  // Testo letto potenzialmente lungo: se ne mostra un pezzo, il resto solo a richiesta.
  const [fullText, setFullText] = useState(false);

  // Scheda / Letto dal dispositivo / Chiedi a Hinthia: quale delle tre tab è attiva a destra --- "Proposte"
  // non esiste più come tab a sé (v. feedback utente): quello che c'è da accettare vive già dentro una delle
  // due letture. Si azzera su "scheda" a ogni apertura della pagina, come fullText --- nessuna persistenza
  // necessaria; "scheda" di default perché prima era sempre visibile a sinistra, mai dietro un click.
  const [activeTab, setActiveTab] = useState<"scheda" | "reading" | "analysis">("scheda");

  // Fusione Scheda/Modifica: i metadati modificabili, sempre live qui (mai una pagina a parte). `null` finché
  // il documento non è ancora caricato. Le proposte (Scadenza/Categoria/Emittente) scrivono direttamente su `doc`
  // via acceptProposal, non su questo stato --- v. i tre effect più sotto, che li tengono sincronizzati uno per
  // uno: un ricalcolo unico sovrascriverebbe una modifica in corso su un ALTRO campo non toccato dalla proposta.
  const [fields, setFields] = useState<DocumentMetadataFieldsValue | null>(null);
  const [savingFields, setSavingFields] = useState(false);

  // Voci libere della Scheda (numero polizza, data di nascita, ...), modificabili come gli altri campi e salvate
  // con "Salva modifiche". Si risincronizzano da `doc` chiave per chiave, non in blocco: dopo un'accettazione
  // cambia solo quella chiave, e una modifica in corso su un'altra non va sovrascritta.
  // Titolo (il nome del contenuto), modificabile in Scheda e salvato con "Salva modifiche". `null` finché il documento non è caricato.
  const [titleValue, setTitleValue] = useState<string | null>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- risincronizza il titolo da `doc` (cambia solo dopo un salvataggio o un ricaricamento).
    setTitleValue(doc?.filename ?? null);
  }, [doc?.filename]);

  const [structuredValues, setStructuredValues] = useState<Record<string, string> | null>(null);
  const prevStructuredRef = useRef<Record<string, string>>({});
  useEffect(() => {
    const next = doc?.structuredFields ?? {};
    const prev = prevStructuredRef.current;
    prevStructuredRef.current = next;
    setStructuredValues((current) => {
      if (current === null) return { ...next };
      const merged = { ...current };
      for (const key of new Set([...Object.keys(prev), ...Object.keys(next)])) {
        if (prev[key] === next[key]) continue;
        if (next[key] === undefined) delete merged[key];
        else merged[key] = next[key];
      }
      return merged;
    });
  }, [doc?.structuredFields]);

  // Sincronizzano UN campo alla volta da `doc` a `fields` quando una proposta lo scrive --- mai un ricalcolo
  // unico dell'intero oggetto, che sovrascriverebbe una modifica in corso su un campo diverso (v. commento sopra).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- risincronizza `fields` da `doc`, non solo un DOM esterno.
    setFields((prev) => (prev ? { ...prev, categoryId: doc?.categoryId ?? "" } : prev));
  }, [doc?.categoryId]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- v. sopra.
    setFields((prev) =>
      prev ? { ...prev, expiresAt: doc?.expiresAt ? doc.expiresAt.slice(0, 10) : "" } : prev,
    );
  }, [doc?.expiresAt]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- v. sopra.
    setFields((prev) => (prev ? { ...prev, issuer: doc?.issuer ?? "" } : prev));
  }, [doc?.issuer]);

  // Contatore di richieste --- v. EditArchiveItemForm (StrictMode invoca l'effetto due volte al mount).
  const latestRequestRef = useRef(0);

  const refresh = useCallback(async () => {
    const requestId = ++latestRequestRef.current;
    setError(null);
    try {
      const [documents, assetsResult, categoriesResult, dossiersResult, rejectionsResult, vocabularyResult] =
        await Promise.all([
          listDocuments(supabase, masterKey),
          listAssets(supabase, masterKey),
          listCategories(supabase),
          listDossiers(supabase, masterKey),
          listProposalRejections(supabase, masterKey, documentId),
          listFieldVocabulary(supabase),
        ]);
      if (requestId !== latestRequestRef.current) return;
      const found = documents.find((d) => d.id === documentId) ?? null;
      setDoc(found);
      setFields((prev) => prev ?? (found ? documentToFields(found) : null));
      setAssets(assetsResult);
      setCategories(categoriesResult);
      setDossiers(dossiersResult);
      setRejections(rejectionsResult);
      setFieldVocabulary(vocabularyResult);
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
      const accepted = await acceptProposal(supabase, masterKey, ownerId, doc, proposal, value);
      return {
        message:
          proposal.kind === "expiry"
            ? `Scadenza impostata al ${formatDate(value)}.`
            : proposal.kind === "issuer"
              ? "Emittente impostato."
              : proposal.kind === "field"
                ? `${proposal.fieldLabel ?? "Campo"} impostato.`
                : "Categoria impostata.",
        onUndo: () =>
          void runProposalAction(async (undoOwnerId) => {
            await undoAcceptance(supabase, masterKey, undoOwnerId, doc.id, accepted);
            return { message: "Annullato.", onUndo: () => setUndoable(null) };
          }),
      };
    });
  }

  /** Una sola proposta per tipo (per "campo": per chiave) --- con più candidati della stessa cosa vince la prima, non si sovrascrive in sequenza. */
  function handleAcceptAll(candidates: Proposal[]) {
    if (!doc || candidates.length === 0) return;
    void runProposalAction(async (ownerId) => {
      const accepted: AcceptedProposal[] = [];
      try {
        for (const proposal of candidates) {
          accepted.push(await acceptProposal(supabase, masterKey, ownerId, doc, proposal, proposal.value));
        }
      } catch (err) {
        if (accepted.length > 0) await refresh();
        throw err;
      }
      return {
        message:
          accepted.length === 1 ? "1 informazione aggiunta alla Scheda." : `${accepted.length} informazioni aggiunte alla Scheda.`,
        onUndo: () =>
          void runProposalAction(async (undoOwnerId) => {
            for (const item of [...accepted].reverse()) {
              await undoAcceptance(supabase, masterKey, undoOwnerId, doc.id, item);
            }
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

  /** FASE 22: unica fase irreversibile del piano --- un contenuto uscito è uscito, quindi un window.confirm prima di ogni invio, qualunque sia lo scope scelto. */
  async function handleAnalyzeWithClaude(scope: AIAnalysisScope) {
    if (!doc) return;
    if (!window.confirm(analysisConfirmMessage(planAnalysis(doc)))) {
      return;
    }

    setAiBusy(true);
    setError(null);
    try {
      if (scope === "temporary" && doc.categoryId) {
        await grantCategoryAIExtractionTemporarily(supabase, doc.categoryId, 30);
        await refresh();
      }
      const extracted = await analyzeDocumentWithClaude(doc, categories, scope, { onProgress: setAiProgress });
      setAiFields(extracted);
      if (extracted.synthesis) {
        // Non è una proposta: sostituisce sempre l'ultima lettura, come extractedText/Rileggi per il testo locale.
        await saveAISynthesis(supabase, masterKey, doc.id, extracted.synthesis);
        await refresh();
      }
      // Senza, l'utente non si accorgerebbe che qualcosa è successo: niente più tab "Proposte" a sé, quello che
      // Hinthia ha trovato vive già in "Chiedi a Hinthia".
      setActiveTab("analysis");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossibile analizzare il documento con Hinthia.");
    } finally {
      setAiBusy(false);
      setAiProgress(null);
    }
  }

  async function handleToggleAIExclusion(next: boolean) {
    if (!doc) return;
    setError(null);
    try {
      await updateDocumentAIExtractionExclusion(supabase, doc.id, next);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossibile salvare l'esclusione.");
    }
  }

  /** Fusione Scheda/Modifica: non più una pagina a parte (v. EditArchiveItemForm, ora rimossa). */
  async function handleSaveFields() {
    if (!fields) return;
    if (titleValue !== null && titleValue.trim() === "") {
      setError("Il titolo non può essere vuoto.");
      return;
    }
    setSavingFields(true);
    setError(null);
    try {
      await updateDocumentMetadata(supabase, masterKey, documentId, {
        categoryId: fields.categoryId || null,
        relatedAssetId: fields.relatedAssetId || null,
        dossierIds: fields.dossierIds,
        expiresAt: fields.expiresAt || null,
        notes: fields.notes,
        tags: parseTagsInput(fields.tagsInput),
        issuer: fields.issuer,
        ...(structuredDirty && structuredValues ? { structuredFields: structuredValues } : {}),
        ...(titleDirty && titleValue !== null ? { title: titleValue } : {}),
      });
      await refresh();
      showToast("Modifiche salvate.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossibile aggiornare il contenuto.");
    } finally {
      setSavingFields(false);
    }
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
  const reading = readingStateFor(doc);
  // Calcolati al volo dal testo già decifrato, non salvati: niente da migrare, valgono su tutto l'archivio esistente.
  // Che cosa c'è da proporre, tolto ciò che è già impostato e ciò che l'utente ha già scartato (v. domain/proposals/build.ts).
  const localProposals = buildProposals(doc, categories, rejections);
  // FASE 22: ricalcolate a ogni render come le locali, così accettare/rifiutare le filtra automaticamente allo stesso modo.
  const aiProposals = aiFields ? buildAIProposals(doc, aiFields, rejections) : [];
  const proposals = [...localProposals, ...aiProposals];
  const categoryEnabledForAI = category ? isCategoryEnabledForExtraction(category) : false;

  // "Cosa ne ho ricavato" esclude: ciò che è già una proposta identica, ciò che è già nella scheda (non più una
  // notizia), e il titolo (non applicabile da questa pagina --- vive al caricamento, v. FASE 19b).
  const structuredFields = extractStructuredFields(doc.extractedText).filter((field) => {
    if (field.kind === "title") return false;
    if (proposals.some((p) => p.kind === field.kind && p.value === field.value)) return false;
    if (field.kind === "expiry" && doc.expiresAt?.slice(0, 10) === field.value) return false;
    if (field.kind === "issuer" && doc.issuer === field.value) return false;
    return true;
  });

  // Disabilita "Salva modifiche" quando non c'è nulla da salvare --- confronto per valore, non per riferimento:
  // `fields` è un oggetto nuovo a ogni onChange anche quando il contenuto torna uguale (es. una proposta accettata
  // e poi risincronizzata dagli effect sopra).
  const structuredDirty =
    structuredValues !== null &&
    normalizeStructuredFields(structuredValues) !== normalizeStructuredFields(doc.structuredFields);
  const titleDirty = titleValue !== null && titleValue.trim() !== doc.filename;
  const fieldsDirty =
    (fields !== null && JSON.stringify(fields) !== JSON.stringify(documentToFields(doc))) ||
    structuredDirty ||
    titleDirty;

  // "Accetta tutto": una sola proposta per tipo (per "campo": per chiave) --- v. handleAcceptAll.
  const seenProposalSlots = new Set<string>();
  const acceptAllCandidates = proposals.filter((proposal) => {
    const slot = proposal.kind === "field" ? `field:${proposal.fieldKey}` : proposal.kind;
    if (seenProposalSlots.has(slot)) return false;
    seenProposalSlots.add(slot);
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

      {/* Barra a sé (v. feedback utente): Salva modifiche/Scarica/Elimina, stessa forma per tutti e tre
          (rounded-xl), sopra al riquadro bianco con Anteprima e le tab --- non più dentro la tab Scheda. */}
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          disabled={!fieldsDirty || savingFields}
          onClick={handleSaveFields}
          className="rounded-xl bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-hover disabled:opacity-50"
        >
          {savingFields ? "Salvataggio…" : "Salva modifiche"}
        </button>
        {kind === "note" ? null : (
          <button
            type="button"
            disabled={busy}
            onClick={handleDownload}
            className="rounded-xl border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
          >
            Scarica
          </button>
        )}
        <button
          type="button"
          disabled={busy}
          onClick={handleDelete}
          className="rounded-xl border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950"
        >
          Elimina
        </button>
      </div>

      {/* Anteprima fissa a sinistra (v. feedback utente); Scheda/Letto dal dispositivo/Analisi con Hinthia sono
          tre tab a destra --- niente più Scheda né il trigger di analisi sempre visibili a sinistra.
          Container query (non breakpoint di viewport) perché la larghezza reale dipende anche
          dalla barra laterale, aperta o chiusa. */}
      <div className="@container">
        {/* items-start: senza, il flex allungherebbe la colonna fissa fino all'altezza del pannello attivo. */}
        <div className="flex flex-col items-stretch gap-6 @3xl:flex-row @3xl:items-start">
          {/* Colonna fissa: solo l'anteprima, sempre visibile, mai dietro una tab. */}
          <div className="flex flex-col gap-6 @3xl:w-[380px] @3xl:shrink-0">
          <section aria-label="Anteprima" className="flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-white shadow-[0_8px_20px_rgba(16,24,40,0.04)] p-4 dark:border-zinc-800 dark:bg-zinc-950">
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
          </div>

          {/* Colonna a tab: Scheda / Letto dal dispositivo / Analisi con Hinthia --- niente più "Proposte" a sé
              (v. feedback utente): quello che c'è da accettare vive già dentro una delle due letture, secondo
              la fonte. Scheda è la prima tab, non più fissa a sinistra (v. feedback utente). Tab e pannelli
              dentro un unico riquadro bianco con contorno (v. feedback utente), come Anteprima a fianco. */}
          <div className="flex min-w-0 flex-1 flex-col gap-4">
          <div className="flex flex-col gap-4 rounded-2xl border border-zinc-200 bg-white p-4 shadow-[0_8px_20px_rgba(16,24,40,0.04)] dark:border-zinc-800 dark:bg-zinc-950">
            <div role="tablist" className="flex flex-wrap gap-1 border-b border-zinc-200 dark:border-zinc-800">
              <button
                type="button"
                role="tab"
                id="tab-scheda"
                aria-selected={activeTab === "scheda"}
                aria-controls="tabpanel-scheda"
                onClick={() => setActiveTab("scheda")}
                className={`rounded-t-md px-3 py-2 text-sm font-medium ${
                  activeTab === "scheda"
                    ? "border-b-2 border-brand text-brand"
                    : "text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
                }`}
              >
                Scheda
              </button>
              <button
                type="button"
                role="tab"
                id="tab-reading"
                aria-selected={activeTab === "reading"}
                aria-controls="tabpanel-reading"
                onClick={() => setActiveTab("reading")}
                className={`rounded-t-md px-3 py-2 text-sm font-medium ${
                  activeTab === "reading"
                    ? "border-b-2 border-brand text-brand"
                    : "text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
                }`}
              >
                Letto dal dispositivo{localProposals.length > 0 ? ` · ${localProposals.length}` : ""}
              </button>
              <button
                type="button"
                role="tab"
                id="tab-analysis"
                aria-selected={activeTab === "analysis"}
                aria-controls="tabpanel-analysis"
                onClick={() => setActiveTab("analysis")}
                className={`rounded-t-md px-3 py-2 text-sm font-medium ${
                  activeTab === "analysis"
                    ? "border-b-2 border-brand text-brand"
                    : "text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
                }`}
              >
                Chiedi a Hinthia{aiProposals.length > 0 ? ` · ${aiProposals.length}` : ""}
              </button>
            </div>

            {/* L'annullamento resta visibile a cambio tab: una sola istanza sopra i pannelli, non una per tab.
                aria-label distinto dal toast globale (v. ToastProvider): entrambi sono role="status". */}
            {undoable ? (
              <div
                role="status"
                aria-label="Ultima proposta"
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-brand/20 bg-brand/5 px-3 py-2 text-sm text-zinc-700 dark:text-zinc-300"
              >
                <span>{undoable.message}</span>
                <button
                  type="button"
                  onClick={undoable.onUndo}
                  className="font-medium text-brand underline-offset-2 hover:underline"
                >
                  Annulla
                </button>
              </div>
            ) : null}

            {/* Un solo pannello montato alla volta, come SettingsTabs.tsx --- non tutti nascosti con `hidden`. */}
            {activeTab === "scheda" ? (
              <div id="tabpanel-scheda" role="tabpanel" aria-labelledby="tab-scheda" className="flex flex-col gap-3">
                {/* Fusione Scheda/Modifica (v. feedback utente): niente più una pagina /edit a parte, i campi
                    sono sempre modificabili qui --- un "Salva modifiche" li mette via quando ce n'è bisogno. */}
                {acceptAllCandidates.length > 0 ? (
                  <div
                    role="group"
                    aria-label="Informazioni trovate da Hinthia"
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-brand/20 bg-brand/5 px-3 py-2"
                  >
                    <p className="text-sm text-zinc-700 dark:text-zinc-300">
                      {acceptAllCandidates.length === 1
                        ? "Hinthia ha trovato 1 informazione da aggiungere alla Scheda."
                        : `Hinthia ha trovato ${acceptAllCandidates.length} informazioni da aggiungere alla Scheda.`}
                    </p>
                    <button
                      type="button"
                      disabled={proposalBusy}
                      onClick={() => handleAcceptAll(acceptAllCandidates)}
                      className="rounded-xl bg-brand px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-hover disabled:opacity-50"
                    >
                      Accetta tutto
                    </button>
                  </div>
                ) : null}
                {titleValue !== null ? (
                  <div className="flex flex-col gap-1">
                    <label htmlFor="scheda-title" className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                      Titolo
                    </label>
                    <input
                      id="scheda-title"
                      type="text"
                      value={titleValue}
                      onChange={(e) => setTitleValue(e.target.value)}
                      className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
                    />
                  </div>
                ) : null}
                {fields ? (
                  <DocumentMetadataFields
                    idPrefix="scheda"
                    categories={categories}
                    assets={assets}
                    dossiers={dossiers}
                    value={fields}
                    onChange={setFields}
                  />
                ) : null}
                {structuredValues && Object.keys(structuredValues).length > 0 ? (
                  <div className="flex flex-col gap-3 border-t border-zinc-100 pt-3 dark:border-zinc-900">
                    {Object.entries(structuredValues).map(([key, value]) => {
                      const inputId = `scheda-field-${key}`;
                      return (
                        <div key={key} className="flex flex-col gap-1">
                          <label htmlFor={inputId} className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                            {fieldVocabulary.find((v) => v.fieldKey === key)?.label ?? key}
                          </label>
                          {/* Il tipo segue il dato salvato, non quello che si sta digitando: una data si sceglie dal calendario. */}
                          <input
                            id={inputId}
                            type={inferFieldInputType(doc.structuredFields[key] ?? value)}
                            value={value}
                            onChange={(e) => setStructuredValues({ ...structuredValues, [key]: e.target.value })}
                            className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
                          />
                        </div>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            ) : activeTab === "reading" ? (
              <div id="tabpanel-reading" role="tabpanel" aria-labelledby="tab-reading" className="flex flex-col gap-6">
                <ProposalsSection
                  proposals={localProposals}
                  categories={categories}
                  busy={proposalBusy}
                  onAccept={handleAcceptProposal}
                  onReject={handleRejectProposal}
                />
                <StructuredFieldsSection fields={structuredFields} />
                <ReadingSection
                  doc={doc}
                  reading={reading}
                  rereading={rereading}
                  fullText={fullText}
                  onToggleFullText={() => setFullText((v) => !v)}
                  onReread={handleReread}
                />
              </div>
            ) : (
              <div id="tabpanel-analysis" role="tabpanel" aria-labelledby="tab-analysis" className="flex flex-col gap-6">
                {/* Il trigger vive qui, non più fisso a sinistra (v. feedback utente): "Analisi con Hinthia" è
                    sia dove si chiede la lettura sia dove ne arriva il risultato. */}
                <AIAnalysisTrigger
                  masterEnabled={masterEnabled}
                  extractionConsent={extractionConsent}
                  hasCategory={doc.categoryId !== null}
                  categoryEnabled={categoryEnabledForAI}
                  excluded={doc.aiExtractionExcluded}
                  busy={aiBusy}
                  progress={aiProgress}
                  onAnalyze={handleAnalyzeWithClaude}
                  onToggleExcluded={handleToggleAIExclusion}
                />
                <ProposalsSection
                  proposals={aiProposals}
                  categories={categories}
                  busy={proposalBusy}
                  onAccept={handleAcceptProposal}
                  onReject={handleRejectProposal}
                />
                {doc.aiSynthesis ? (
                  <section
                    aria-label="Analisi con Hinthia"
                    className="flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950"
                  >
                    <h2 className="flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                      {/* eslint-disable-next-line @next/next/no-img-element -- copia ridotta dell'avatar HINTHIA, v. public/brand/README.md */}
                      <img src="/brand/hinthia/hinthia-64.png" alt="" className="h-5 w-5 shrink-0 rounded-full" />
                      Analisi con Hinthia
                    </h2>
                    <p className="whitespace-pre-wrap text-sm text-zinc-700 dark:text-zinc-300">{doc.aiSynthesis}</p>
                    {doc.aiSynthesisGeneratedAt ? (
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">
                        Letta il {formatDate(doc.aiSynthesisGeneratedAt)}
                      </p>
                    ) : null}
                  </section>
                ) : (
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">
                    Non hai ancora chiesto a Hinthia di leggere questo documento.
                  </p>
                )}
              </div>
            )}
          </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Confronto per valore, senza voci vuote né ordine: una voce svuotata equivale a una rimossa. */
function normalizeStructuredFields(fields: Record<string, string>): string {
  return JSON.stringify(
    Object.entries(fields)
      .filter(([, value]) => value.trim() !== "")
      .sort(([a], [b]) => a.localeCompare(b)),
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
      <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Cosa ho letto</h2>

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
