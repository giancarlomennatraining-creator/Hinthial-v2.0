/**
 * FASE 9 --- everything the export bundle contains, already decrypted
 * client-side. This is the shape written as `manifest.json` at the root
 * of the exported .zip; actual file bytes (documents, capsule
 * attachments) live alongside it as separate entries, referenced here by
 * their path inside the archive.
 */
export interface ExportManifest {
  generatedAt: string;
  /** Bump if the manifest shape ever changes, so a future importer/reader can tell versions apart. */
  hinthialExportVersion: 1;
  profile: {
    firstName: string;
    lastName: string;
    email: string;
  };
  categories: {
    id: string;
    name: string;
    icon: string;
  }[];
  assets: {
    id: string;
    name: string;
    categoryId: string | null;
    createdAt: string;
  }[];
  documents: {
    id: string;
    filename: string;
    mimeType: string;
    size: number;
    categoryId: string | null;
    relatedAssetId: string | null;
    expiresAt: string | null;
    notes: string;
    tags: string[];
    createdAt: string;
    /** Path inside the archive where the decrypted file itself was included, or null if it couldn't be fetched. */
    exportedAs: string | null;
  }[];
  reminders: {
    id: string;
    title: string;
    dueAt: string;
    completed: boolean;
    relatedDocumentId: string | null;
    relatedAssetId: string | null;
    createdAt: string;
  }[];
  trustedContacts: {
    id: string;
    name: string;
    email: string;
    role: string;
    status: string;
    createdAt: string;
  }[];
  capsules: {
    id: string;
    title: string;
    content: string;
    status: string;
    accessCondition: string;
    openAt: string | null;
    relatedContactIds: string[];
    linkedDocumentIds: string[];
    createdAt: string;
    attachments: {
      id: string;
      filename: string;
      mimeType: string;
      size: number;
      exportedAs: string | null;
    }[];
  }[];
}

export interface ExportFile {
  /** Path inside the .zip archive, e.g. "documenti/<id>-fattura.pdf". */
  path: string;
  data: Uint8Array;
}

export interface ExportResult {
  manifest: ExportManifest;
  /** Every file to zip, manifest.json included. */
  files: ExportFile[];
}
