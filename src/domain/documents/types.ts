export interface Category {
  id: string;
  name: string;
  icon: string;
}

/**
 * A document as used by the UI: `filename` is already decrypted
 * client-side (for display); `wrappedDocumentKey`/`storagePath` are kept
 * around (still opaque) so opening/deleting doesn't need a second fetch.
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
}
