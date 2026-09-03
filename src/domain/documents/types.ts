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
}

/** Fields collected at upload time, in addition to the file itself. */
export interface DocumentMetadataInput {
  categoryId: string | null;
  relatedAssetId: string | null;
  expiresAt: string | null;
  notes: string;
  tags: string[];
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
