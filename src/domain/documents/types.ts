import type { AnalysisStatus, PersistedContentAnalysis } from "@/domain/ai/analysis/persisted";

/** `filename`/`notes`/`tags` già decifrati client-side; `wrappedDocumentKey`/`storagePath` restano opachi per evitare un secondo fetch. */
/**
 * Un documento senza le colonne pesanti (testo letto, trascrizione, sintesi, analisi di Hinthia): quanto basta per
 * elenchi, conteggi e selettori. Quel testo può pesare fino a 200.000 caratteri a documento, e scaricarlo e
 * decifrarlo per tutti i documenti a ogni apertura di una pagina costa tempo che cresce con l'archivio. Chi ha
 * bisogno del contenuto usa `DocumentListItem` (`listDocuments`, `getDocumentById`).
 */
export type DocumentSummary = Omit<
  DocumentListItem,
  "transcript" | "extractedText" | "aiSynthesis" | "contentAnalysis"
>;

export interface DocumentListItem {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  categoryId: string | null;
  /** FASE 6: the asset (if any) this document belongs to. */
  relatedAssetId: string | null;
  createdAt: string;
  storagePath: string;
  wrappedDocumentKey: string;
  /** null when never set. */
  expiresAt: string | null;
  /** empty string when never set. */
  notes: string;
  tags: string[];
  /** Audio/video only, empty string when never set --- v. domain/transcription. */
  transcript: string;
  /** FASE 17: testo ricavato dal contenuto per la ricerca dentro i file --- non mostrato/modificabile come `transcript`. */
  extractedText: string;
  /** FASE 17b: `null` = mai tentata (pre-FASE 17); distingue "da recuperare" da "guardato, senza testo" (una scansione). */
  extractedAt: string | null;
  /** V. lib/thumbnail.ts --- falso per i tipi senza miniatura o per contenuti caricati prima che esistesse. */
  hasThumbnail: boolean;
  /** FASE 20/20c: indipendente da categoryId/relatedAssetId --- un fascicolo attraversa le categorie, un documento può stare in più di uno. */
  dossierIds: string[];
  /** Cestino --- quando è stato spostato lì, null se non è nel cestino. */
  deletedAt: string | null;
  /** Cestino --- quando verrà eliminato per sempre, fissato al momento dello spostamento (v. migrazione 20260923000000). null se non è nel cestino. */
  purgeAt: string | null;
  /** Cifrato come le note; modificabile a mano o proponibile da Hinthial (v. domain/proposals) quando lo riconosce nel testo. */
  issuer: string;
  /** FASE 22: esclusione permanente di questo documento dall'analisi Claude, anche con la categoria abilitata --- vince sempre. */
  aiExtractionExcluded: boolean;
  /** Campi eterogenei aperti (numero polizza, targa, ...) --- {} se nessuno. Le chiavi vivono nel vocabolario personale, v. domain/structured-fields. */
  structuredFields: Record<string, string>;
  /** Sintesi/descrizione/analisi in prosa dell'ultima lettura Claude riuscita --- "" se non ancora letto. Sostituita, mai una proposta. */
  aiSynthesis: string;
  /** Quando aiSynthesis è stata generata --- null se il documento non è mai stato letto da Claude. */
  aiSynthesisGeneratedAt: string | null;
  /** L'ultima lettura di Hinthia --- blocchi con citazione e provenienza, impronta, ripresa. null se mai letto o se il blocco cifrato non si legge più. */
  contentAnalysis: PersistedContentAnalysis | null;
  /** Stato grossolano in chiaro --- null se mai letto. */
  analysisStatus: AnalysisStatus | null;
  analysisUpdatedAt: string | null;
}

/** Fields collected at upload time, in addition to the file itself. */
export interface DocumentMetadataInput {
  categoryId: string | null;
  relatedAssetId: string | null;
  /** FASE 20c --- [] se non assegnato a nessun fascicolo, uno o più altrimenti. */
  dossierIds: string[];
  expiresAt: string | null;
  notes: string;
  tags: string[];
  issuer: string;
  /** Voci libere della Scheda (v. domain/structured-fields): se presente sostituisce l'intero insieme, se omesso non lo tocca. */
  structuredFields?: Record<string, string>;
  /** Nuovo titolo (il nome del contenuto): se presente e non vuoto lo rinomina, se omesso non lo tocca. */
  title?: string;
}

/** Distinta da `DocumentMetadataInput.notes` --- qui titolo/corpo SONO il contenuto, cifrati come un file (v. createTextNote). */
export interface TextNoteInput {
  title: string;
  body: string;
}
