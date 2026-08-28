export interface ReminderListItem {
  id: string;
  /** Decrypted client-side for display. */
  title: string;
  dueAt: string;
  completed: boolean;
  /**
   * Placeholder relation until FASE 6 (Asset) generalizes it --- for now
   * a reminder can only relate to a document.
   */
  relatedDocumentId: string | null;
  relatedDocumentFilename: string | null;
  createdAt: string;
}

export interface ReminderInput {
  title: string;
  dueAt: string;
  relatedDocumentId: string | null;
}
