import type { DocumentListItem } from "@/domain/documents/types";
import type { TrustedContactListItem } from "@/domain/contacts/types";

/**
 * FASE 8: bozza -> chiusa -> condivisa. Chiudere è irreversibile e, da
 * FASE 14, rende la capsula autosufficiente: ogni contenuto d'Archivio
 * referenziato viene copiato al suo interno (v. repository.ts,
 * closeCapsule) --- l'originale in Archivio torna libero non appena la
 * copia è fatta, nessun blocco di sorta. "Condividi" resta solo un
 * cambio di stato registrato (v. HINTHIAL_MVP.md, come per il contatto
 * fiduciario di FASE 7) --- non concede ancora alcun accesso reale a
 * nessuno. L'apertura vera e propria da parte dei destinatari arriverà
 * con la futura fase Dead Man's Switch (FASE 12-13).
 */
export type CapsuleStatus = "draft" | "ready" | "shared";

/** Solo "manuale" per l'MVP --- pensato per essere ampliato quando arriverà il Dead Man's Switch (FASE 13). */
export type CapsuleAccessCondition = "manual";

/**
 * A file that belongs to this capsule alone --- own Document Key, own
 * blob in Storage, no dependency on anything else. Either uploaded/
 * recorded fresh at creation time (always audio/video, kept private on
 * purpose --- v. CreateCapsuleForm), or produced by closeCapsule() as a
 * snapshot of a linked Archivio item at closing time.
 */
export interface CapsuleAttachment {
  /** Anche il segmento finale del path in Storage (owner/capsule/attachment.json). */
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  /** Serialized EncryptedEnvelope --- wraps this attachment's own Document Key. */
  wrappedDocumentKey: string;
  /** Audio/video only, scritta a mano (v. domain/transcription) --- assente se mai impostata. */
  transcript?: string;
}

export interface CapsuleListItem {
  id: string;
  /** Decrypted client-side for display. */
  title: string;
  content: string;
  attachments: CapsuleAttachment[];
  /**
   * Existing Archivio entries referenced by id, only while the capsule
   * is still a draft --- no copy, no separate encryption: reuses the
   * item's own Document Key/Storage blob. Closing the capsule
   * (closeCapsule) turns each of these into its own CapsuleAttachment
   * and empties this list --- a closed capsule never has any. Ids
   * whose item was since deleted are silently omitted (shorter list
   * than what was originally linked).
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
