/**
 * A document as used by the UI: `filename`/`notes`/`tags` are already
 * decrypted client-side (for display); `wrappedDocumentKey`/
 * `storagePath` are kept around (still opaque) so opening/deleting
 * doesn't need a second fetch.
 */
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
  /**
   * FASE 17 --- testo ricavato automaticamente dal contenuto (oggi: i
   * PDF), estratto sul dispositivo prima della cifratura e salvato
   * cifrato come tutto il resto (v. domain/extraction). Serve a cercare
   * DENTRO i file, non solo tra i nomi: non è pensato per essere
   * mostrato né modificato, a differenza di `transcript`, che l'utente
   * scrive a mano. Stringa vuota se non applicabile o non estratto.
   */
  extractedText: string;
  /**
   * FASE 17b --- quando l'estrazione è stata *tentata*, a prescindere
   * dall'esito. `null` significa "mai tentata" (contenuto caricato
   * prima della FASE 17): è ciò che distingue un documento ancora da
   * recuperare da uno già guardato che semplicemente non aveva testo da
   * dare, come una scansione.
   */
  extractedAt: string | null;
  /**
   * Se esiste una miniatura del contenuto (v. lib/thumbnail.ts): quando
   * true, la scheda può mostrare un'anteprima scaricando qualche decina
   * di kilobyte invece del file intero. Falso per i tipi che non ne
   * hanno una (audio, video, note) e per i contenuti caricati prima che
   * questa possibilità esistesse.
   */
  hasThumbnail: boolean;
  /**
   * FASE 20/20c --- i fascicoli a cui appartiene, se assegnato
   * manualmente. Indipendente da `categoryId`/`relatedAssetId`: un
   * fascicolo attraversa le categorie, non le sostituisce --- un
   * documento può avere una categoria, un bene e uno o più fascicoli
   * insieme (un codice fiscale può servire a più vicende insieme, v.
   * domain/dossiers/repository.ts, replaceDocumentDossierLinks).
   */
  dossierIds: string[];
  /** Cestino --- quando è stato spostato lì, null se non è nel cestino. */
  deletedAt: string | null;
  /** Cestino --- quando verrà eliminato per sempre, fissato al momento dello spostamento (v. migrazione 20260923000000). null se non è nel cestino. */
  purgeAt: string | null;
  /**
   * Chi ha emesso il documento --- cifrato come le note (v.
   * repository.ts, `encrypted_issuer`), stringa vuota quando non
   * impostato. Modificabile a mano nel form, e proponibile da Hinthial
   * (v. FASE 18/19, domain/proposals) quando lo riconosce nel testo.
   */
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

/**
 * A text note's own content (title + body) --- distinct from
 * `DocumentMetadataInput.notes`, which is a free-text annotation field
 * every archive item has regardless of kind. A note's title/body *is*
 * the content, encrypted exactly like a file's name/bytes would be (v.
 * domain/documents/repository.ts, createTextNote).
 */
export interface TextNoteInput {
  title: string;
  body: string;
}
