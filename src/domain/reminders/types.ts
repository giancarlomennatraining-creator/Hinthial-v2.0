export interface ReminderListItem {
  id: string;
  /** Decrypted client-side for display. */
  title: string;
  dueAt: string;
  completed: boolean;
  /** Independent of relatedAssetId: a reminder can relate to a document, an asset, both, or neither. */
  relatedDocumentId: string | null;
  relatedDocumentFilename: string | null;
  relatedAssetId: string | null;
  relatedAssetName: string | null;
  createdAt: string;
}

export interface ReminderInput {
  title: string;
  dueAt: string;
  relatedDocumentId: string | null;
  relatedAssetId: string | null;
}
