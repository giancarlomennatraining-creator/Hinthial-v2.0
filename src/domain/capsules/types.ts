import type { DocumentListItem } from "@/domain/documents/types";
import type { TrustedContactListItem } from "@/domain/contacts/types";

/**
 * FASE 8: bozza -> chiusa -> condivisa. Chiudere è irreversibile (non più
 * modificabile, i documenti collegati non sono più cancellabili finché
 * la capsula esiste) ma non concede ancora alcun accesso reale a nessuno
 * --- "Condividi" resta solo un cambio di stato registrato
 * (v. HINTHIAL_MVP.md, come per il contatto fiduciario di FASE 7).
 * L'apertura vera e propria da parte dei destinatari arriverà con la
 * futura fase Dead Man's Switch (FASE 12-13).
 */
export type CapsuleStatus = "draft" | "ready" | "shared";

/** Solo "manuale" per l'MVP --- pensato per essere ampliato quando arriverà il Dead Man's Switch (FASE 13). */
export type CapsuleAccessCondition = "manual";

/** A file uploaded fresh, just for this capsule --- own Document Key, own blob in Storage. */
export interface CapsuleAttachment {
  /** Anche il segmento finale del path in Storage (owner/capsule/attachment.json). */
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  /** Serialized EncryptedEnvelope --- wraps this attachment's own Document Key. */
  wrappedDocumentKey: string;
}

export interface CapsuleListItem {
  id: string;
  /** Decrypted client-side for display. */
  title: string;
  content: string;
  /** Uploaded fresh, just for this capsule. */
  attachments: CapsuleAttachment[];
  /**
   * Existing Documenti vault entries referenced by id --- no copy, no
   * separate encryption: reuses the document's own Document Key/Storage
   * blob. Ids whose document was since deleted are silently omitted
   * (shorter list than what was originally linked).
   */
  linkedDocuments: DocumentListItem[];
  /**
   * One or more trusted contacts (FASE 7) --- ids live inside
   * encrypted_payload, not a plaintext column, so the server can't see
   * which contacts a capsule is meant for either. Ids whose contact was
   * since deleted are silently omitted, same as linkedDocuments.
   */
  relatedContacts: TrustedContactListItem[];
  status: CapsuleStatus;
  accessCondition: CapsuleAccessCondition;
  /**
   * Data (facoltativa) in cui la capsula è pensata per essere aperta ---
   * solo un metadato per ora, come una vera capsula del tempo: nessuna
   * apertura automatica avviene a quella data (v. CapsuleStatus).
   * ISO YYYY-MM-DD, null se non impostata.
   */
  openAt: string | null;
  createdAt: string;
}

/** Fields collected at creation time. */
export interface CapsuleInput {
  title: string;
  content: string;
  relatedContactIds: string[];
  files: File[];
  linkedDocumentIds: string[];
  openAt: string | null;
}

/** Editable while status is "draft" only --- uploaded attachments aren't (see updateCapsule). */
export interface CapsuleEditInput {
  title: string;
  content: string;
  relatedContactIds: string[];
  linkedDocumentIds: string[];
  openAt: string | null;
}

/**
 * Ids of Documenti entries currently locked against deletion ---
 * referenced by any capsule that's no longer a draft (v. Documenti,
 * deleteDocument is expected to check this before deleting). Deleting
 * the capsule itself (not covered here) is what lifts the lock.
 */
export function lockedDocumentIds(capsules: CapsuleListItem[]): Set<string> {
  const ids = new Set<string>();
  for (const capsule of capsules) {
    if (capsule.status === "draft") continue;
    for (const doc of capsule.linkedDocuments) ids.add(doc.id);
  }
  return ids;
}
