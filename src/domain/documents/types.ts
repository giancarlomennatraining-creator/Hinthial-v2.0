export interface Category {
  id: string;
  name: string;
  icon: string;
}

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
  createdAt: string;
  storagePath: string;
  wrappedDocumentKey: string;
  /** null when never set. */
  expiresAt: string | null;
  /** empty string when never set. */
  notes: string;
  tags: string[];
}

/** Fields collected at upload time, in addition to the file itself. */
export interface DocumentMetadataInput {
  categoryId: string | null;
  expiresAt: string | null;
  notes: string;
  tags: string[];
}
