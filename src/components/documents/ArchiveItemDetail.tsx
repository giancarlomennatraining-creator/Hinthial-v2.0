"use client";

import { useState } from "react";
import { readingStateFor } from "@/domain/extraction/reading-state";
import { CONTENT_KIND_ICON, CONTENT_KIND_LABEL } from "@/lib/content-kind";
import { formatDate, formatSize } from "@/lib/format";
import { PANEL } from "@/components/ui/styles";
import { BackLink, ContextBackLink } from "@/components/ui/BackLink";
import { ErrorText } from "@/components/ui/ErrorText";
import { LoadingText } from "@/components/ui/LoadingText";
import { AnalysisPanel } from "@/components/documents/detail/AnalysisPanel";
import { DocumentActionBar } from "@/components/documents/detail/DocumentActionBar";
import { DocumentPreviewPanel } from "@/components/documents/detail/DocumentPreviewPanel";
import { DocumentTabList, UndoableStatus, type DocumentTab } from "@/components/documents/detail/DocumentTabs";
import { ReadingSection } from "@/components/documents/detail/ReadingSection";
import { SchedaPanel } from "@/components/documents/detail/SchedaPanel";
import { useDocumentActions } from "@/components/documents/detail/useDocumentActions";
import { useDocumentAnalysis } from "@/components/documents/detail/useDocumentAnalysis";
import { useDocumentData } from "@/components/documents/detail/useDocumentData";
import { useDocumentFields } from "@/components/documents/detail/useDocumentFields";
import { useDocumentPreview } from "@/components/documents/detail/useDocumentPreview";
import { useDocumentProposals } from "@/components/documents/detail/useDocumentProposals";

/**
 * Scheda di un contenuto d'Archivio --- fonde vista e modifica (v. feedback utente: due pagine separate creavano
 * confusione): niente più `/archive/[id]/edit`, i campi della Scheda sono sempre modificabili qui, un "Salva
 * modifiche" li mette via. Mostra anche cosa Hinthial ha estratto dal file, a dimostrazione che resta sul
 * dispositivo. Niente più tab "Proposte" a sé: quello che c'è da accettare/rifiutare vive dentro "Letto dal
 * dispositivo" (locale) o "Chiedi a Hinthia" (Claude), a seconda di dove viene. Niente sezioni vuote per fasi
 * future --- sembrerebbero quasi finite e non lo sono.
 *
 * Qui solo la composizione: i dati, l'anteprima, i campi, le proposte, la lettura di Hinthia e le azioni vivono
 * ciascuno nel proprio hook (cartella `detail/`), i pezzi di pagina nei propri componenti.
 */
export function ArchiveItemDetail({
  masterKey,
  documentId,
}: {
  masterKey: CryptoKey;
  documentId: string;
}) {
  const data = useDocumentData(masterKey, documentId);
  const { doc, categories, assets, dossiers, rejections, fieldVocabulary, loading, error, setError, refresh } = data;

  // Scheda / Letto dal dispositivo / Chiedi a Hinthia: quale delle tre tab è attiva a destra. Si azzera su
  // "scheda" a ogni apertura della pagina, come fullText --- nessuna persistenza necessaria; "scheda" di default
  // perché prima era sempre visibile a sinistra, mai dietro un click.
  const [activeTab, setActiveTab] = useState<DocumentTab>("scheda");
  // Testo letto potenzialmente lungo: se ne mostra un pezzo, il resto solo a richiesta.
  const [fullText, setFullText] = useState(false);

  const preview = useDocumentPreview(masterKey, doc, setError);
  const fieldsState = useDocumentFields(masterKey, documentId, doc, refresh, setError);
  const proposals = useDocumentProposals(masterKey, data);
  // Senza il passaggio alla tab, l'utente non si accorgerebbe che qualcosa è successo: quello che Hinthia ha
  // trovato vive già in "Chiedi a Hinthia".
  const analysis = useDocumentAnalysis(masterKey, data, () => setActiveTab("analysis"));
  const actions = useDocumentActions(masterKey, data);

  const { kind, isPdf } = preview;

  if (loading) {
    return <LoadingText />;
  }

  if (!doc || !kind) {
    return (
      <div className="flex flex-col gap-4">
        <BackLink href="/archive">Torna all&apos;archivio</BackLink>
        <ErrorText>
          Contenuto non trovato.
        </ErrorText>
      </div>
    );
  }

  const category = categories.find((c) => c.id === doc.categoryId);
  const reading = readingStateFor(doc);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <ContextBackLink parent={{ href: "/archive", label: "Torna all'archivio" }} />
        <h1 className="mt-2 flex min-w-0 items-start gap-2 text-2xl font-semibold tracking-tight text-title">
          <span aria-hidden="true">{CONTENT_KIND_ICON[kind]}</span>
          <span className="min-w-0 break-words">{doc.filename}</span>
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          {CONTENT_KIND_LABEL[kind]} · {formatSize(doc.size)} · aggiunto il{" "}
          {formatDate(doc.createdAt)}
        </p>
      </div>

      {error ? (
        <ErrorText>
          {error}
        </ErrorText>
      ) : null}

      <DocumentActionBar
        documentId={doc.id}
        isNote={kind === "note"}
        dirty={fieldsState.fieldsDirty}
        saving={fieldsState.savingFields}
        busy={actions.busy}
        onSave={fieldsState.handleSaveFields}
        onDownload={actions.handleDownload}
        onDelete={actions.handleDelete}
      />

      {/* Anteprima fissa a sinistra (v. feedback utente); Scheda/Letto dal dispositivo/Analisi con Hinthia sono
          tre tab a destra --- niente più Scheda né il trigger di analisi sempre visibili a sinistra.
          Container query (non breakpoint di viewport) perché la larghezza reale dipende anche
          dalla barra laterale, aperta o chiusa. */}
      <div className="@container">
        {/* items-start: senza, il flex allungherebbe la colonna fissa fino all'altezza del pannello attivo. */}
        <div className="flex flex-col items-stretch gap-6 @3xl:flex-row @3xl:items-start">
          {/* Su telefono l'anteprima viene dopo i campi (order-2): prima si deve poter compilare, non scorrere una schermata di pagina. */}
          <div className="order-2 flex flex-col gap-6 @3xl:order-1 @3xl:w-[380px] @3xl:shrink-0">
            <DocumentPreviewPanel doc={doc} kind={kind} preview={preview} />
          </div>

          {/* Colonna a tab: tab e pannelli dentro un unico riquadro bianco con contorno (v. feedback utente),
              come Anteprima a fianco. */}
          <div className="order-1 flex min-w-0 flex-1 flex-col gap-4 @3xl:order-2">
          <div className={`${PANEL} flex flex-col gap-4 p-4`}>
            <DocumentTabList active={activeTab} onChange={setActiveTab} proposalCount={proposals.proposals.length} />
            {proposals.undoable ? <UndoableStatus undoable={proposals.undoable} /> : null}

            {/* Un solo pannello montato alla volta, come SettingsTabs.tsx --- non tutti nascosti con `hidden`. */}
            {activeTab === "scheda" ? (
              <SchedaPanel
                doc={doc}
                categories={categories}
                assets={assets}
                dossiers={dossiers}
                fieldVocabulary={fieldVocabulary}
                acceptAllCandidates={proposals.acceptAllCandidates}
                proposalBusy={proposals.proposalBusy}
                onAcceptAll={proposals.handleAcceptAll}
                titleValue={fieldsState.titleValue}
                onTitleChange={fieldsState.setTitleValue}
                fields={fieldsState.fields}
                onFieldsChange={fieldsState.setFields}
                structuredValues={fieldsState.structuredValues}
                onStructuredValuesChange={fieldsState.setStructuredValues}
              />
            ) : activeTab === "reading" ? (
              <div id="tabpanel-reading" role="tabpanel" aria-labelledby="tab-reading" className="flex flex-col gap-6">
                <ReadingSection
                  doc={doc}
                  reading={reading}
                  rereading={actions.rereading}
                  fullText={fullText}
                  onToggleFullText={() => setFullText((v) => !v)}
                  onReread={actions.handleReread}
                />
              </div>
            ) : (
              <AnalysisPanel
                doc={doc}
                category={category}
                categories={categories}
                assets={assets}
                rejections={rejections}
                isPdf={isPdf}
                analysis={analysis}
                proposals={proposals}
                loadPdfBytes={preview.loadPdfBytes}
              />
            )}
          </div>
          </div>
        </div>
      </div>
    </div>
  );
}
