import type { DocumentListItem } from "@/domain/documents/types";
import type { FriendListItem } from "@/domain/friends/types";

/** FASE 8: bozza -> chiusa -> condivisa. Chiudere è irreversibile e rende la capsula autosufficiente (v. closeCapsule); "Condividi" resta solo un cambio di stato, l'apertura vera arriva dal Dead Man's Switch (FASE 12-13). */
export type CapsuleStatus = "draft" | "ready" | "shared";

/** Solo "manuale" per l'MVP --- pensato per essere ampliato quando arriverà il Dead Man's Switch (FASE 13). */
export type CapsuleAccessCondition = "manual";

/** Come viene mostrato il testo del messaggio --- una scelta di chi scrive, mai imposta (v. CreateCapsuleForm/EditCapsuleForm/CapsulePreview). */
export type CapsuleContentStyle = "simple" | "handwritten";

/** File proprio della capsula (Document Key/blob propri) --- caricato alla creazione, o prodotto da closeCapsule come copia di un item Archivio. */
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
  /** "simple" per le capsule create prima che questa scelta esistesse. */
  contentStyle: CapsuleContentStyle;
  attachments: CapsuleAttachment[];
  /** Solo mentre draft, riusa la Document Key dell'item --- closeCapsule le trasforma in CapsuleAttachment propri e svuota la lista. */
  linkedDocuments: DocumentListItem[];
  /** Id dentro encrypted_payload, non una colonna in chiaro: il server non sa a chi è destinata la capsula. */
  relatedFriends: FriendListItem[];
  status: CapsuleStatus;
  accessCondition: CapsuleAccessCondition;
  /** Obbligatoria, in chiaro lato server (colonna `open_at`) --- il server deve saperlo senza decifrare nulla. Null solo per capsule pre-migrazione, non ancora sanate (v. listCapsules). */
  openAt: string | null;
  createdAt: string;
}

/** Fields collected at creation time. */
export interface CapsuleInput {
  title: string;
  content: string;
  contentStyle: CapsuleContentStyle;
  relatedFriendIds: string[];
  files: File[];
  linkedDocumentIds: string[];
  openAt: string;
}

/** Editabile solo da "draft". Quali allegati tenere/rimuovere è passato a parte a updateCapsule, non qui. */
export interface CapsuleEditInput {
  title: string;
  content: string;
  contentStyle: CapsuleContentStyle;
  relatedFriendIds: string[];
  linkedDocumentIds: string[];
  newFiles: File[];
  openAt: string;
}

/** FASE B: capsula condivisa da altri ("Condivise con me") --- solo metadati in chiaro, titolo/contenuto restano cifrati (v. SharedCapsuleOpenedContent). */
export interface SharedCapsuleListItem {
  /** Id della capsula --- non del collegamento di condivisione. */
  id: string;
  /** Serve per costruire il percorso Storage degli allegati (v. capsuleAttachmentStoragePath) --- mai mostrato. */
  ownerId: string;
  /** Nome e cognome del proprietario --- già in chiaro lato server. */
  ownerName: string;
  /** ISO --- quando è stata condivisa. */
  sharedAt: string;
  status: CapsuleStatus;
  /** V. CapsuleListItem.openAt --- null solo per le capsule create prima che diventasse obbligatoria. */
  openAt: string | null;
  /** Quando il destinatario ha chiuso il popup di notifica in Dashboard --- null finché non lo fa (v. dismissCapsuleShareNotification). */
  dismissedAt: string | null;
}

/** A differenza di CapsuleAttachment, porta la Document Key già in chiaro (`documentKeyRaw`) --- il destinatario non ha la Master Key del proprietario. */
export interface SharedCapsuleAttachment {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  /** Base64, bytes grezzi della Document Key di questo allegato. */
  documentKeyRaw: string;
  transcript?: string;
}

/** FASE C1: contenuto decifrato via ECDH (v. openSharedCapsule) --- ottenibile solo dopo la data di apertura, prima il DB nega la lettura. */
export interface SharedCapsuleOpenedContent {
  title: string;
  content: string;
  contentStyle: CapsuleContentStyle;
  attachments: SharedCapsuleAttachment[];
}
