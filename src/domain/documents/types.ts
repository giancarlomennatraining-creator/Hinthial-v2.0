/** `filename`/`notes`/`tags` già decifrati client-side; `wrappedDocumentKey`/`storagePath` restano opachi per evitare un secondo fetch. */
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
}

/** Distinta da `DocumentMetadataInput.notes` --- qui titolo/corpo SONO il contenuto, cifrati come un file (v. createTextNote). */
export interface TextNoteInput {
  title: string;
  body: string;
}
