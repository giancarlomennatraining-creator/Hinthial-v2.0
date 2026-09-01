import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import {
  encryptBytes,
  decryptBytes,
  encryptDocument,
  decryptDocument,
  parseEnvelope,
  serializeEnvelope,
  utf8ToBytes,
  bytesToUtf8,
  type EncryptedDocument,
} from "@/lib/crypto";
import {
  capsuleAttachmentStoragePath,
  downloadEncryptedCapsulePayload,
  removeEncryptedCapsulePayloads,
  uploadEncryptedCapsulePayload,
} from "@/lib/storage/capsules-bucket";
import { getDocumentsByIds } from "@/domain/documents/repository";
import { getTrustedContactsByIds } from "@/domain/contacts/repository";
import type {
  CapsuleAccessCondition,
  CapsuleAttachment,
  CapsuleEditInput,
  CapsuleInput,
  CapsuleListItem,
  CapsuleStatus,
} from "@/domain/capsules/types";

const CAPSULE_COLUMNS = "id, encrypted_payload, status, access_condition, created_at";

type CapsuleRow = {
  id: string;
  encrypted_payload: string;
  status: CapsuleStatus;
  access_condition: CapsuleAccessCondition;
  created_at: string;
};

/** What actually lives inside encrypted_payload (see the capsules migration). */
interface CapsulePayload {
  title: string;
  content: string;
  attachments: CapsuleAttachment[];
  /** Ids of existing Documenti vault entries linked as attachments --- resolved via getDocumentsByIds. */
  linkedDocumentIds: string[];
  /** Ids of trusted contacts this capsule is meant for --- resolved via getTrustedContactsByIds. */
  relatedContactIds: string[];
  /** ISO YYYY-MM-DD, or null --- see CapsuleListItem.openAt. */
  openAt: string | null;
}

async function decryptPayload(masterKey: CryptoKey, row: CapsuleRow): Promise<CapsulePayload> {
  const payloadBytes = await decryptBytes(masterKey, parseEnvelope(row.encrypted_payload));
  const payload = JSON.parse(bytesToUtf8(payloadBytes)) as Partial<CapsulePayload>;
  return {
    title: payload.title ?? "",
    content: payload.content ?? "",
    attachments: payload.attachments ?? [],
    linkedDocumentIds: payload.linkedDocumentIds ?? [],
    relatedContactIds: payload.relatedContactIds ?? [],
    openAt: payload.openAt ?? null,
  };
}

/**
 * Lists the current user's capsules (most recent first), decrypting the
 * payload (title/content/attachment metadata) --- any linked Documenti
 * entries and related trusted contacts, if any --- client-side with
 * the Master Key. Both are resolved in one batched query each, across
 * every capsule, not one query per capsule.
 */
export async function listCapsules(
  supabase: SupabaseClient<Database>,
  masterKey: CryptoKey,
): Promise<CapsuleListItem[]> {
  const { data, error } = await supabase
    .from("capsules")
    .select(CAPSULE_COLUMNS)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Impossibile caricare le capsule: ${error.message}`);
  }

  const rows = (data ?? []) as CapsuleRow[];
  const payloads = await Promise.all(rows.map((row) => decryptPayload(masterKey, row)));

  const allLinkedIds = [...new Set(payloads.flatMap((p) => p.linkedDocumentIds))];
  const allContactIds = [...new Set(payloads.flatMap((p) => p.relatedContactIds))];
  const [linkedDocuments, relatedContacts] = await Promise.all([
    getDocumentsByIds(supabase, masterKey, allLinkedIds),
    getTrustedContactsByIds(supabase, masterKey, allContactIds),
  ]);
  const linkedDocumentsById = new Map(linkedDocuments.map((doc) => [doc.id, doc]));
  const relatedContactsById = new Map(relatedContacts.map((contact) => [contact.id, contact]));

  return rows.map((row, i) => {
    const payload = payloads[i];

    return {
      id: row.id,
      title: payload.title,
      content: payload.content,
      attachments: payload.attachments,
      // Ids whose document/contact was since deleted resolve to nothing here --- filtered out on purpose.
      linkedDocuments: payload.linkedDocumentIds
        .map((id) => linkedDocumentsById.get(id))
        .filter((doc): doc is NonNullable<typeof doc> => doc !== undefined),
      relatedContacts: payload.relatedContactIds
        .map((id) => relatedContactsById.get(id))
        .filter((contact): contact is NonNullable<typeof contact> => contact !== undefined),
      status: row.status,
      accessCondition: row.access_condition,
      openAt: payload.openAt,
      createdAt: row.created_at,
    };
  });
}

/**
 * Encrypts and uploads one attachment (own Document Key, like FASE 4),
 * returning the metadata that goes inside the capsule's encrypted
 * payload --- the ciphertext itself lives only in Storage.
 */
async function uploadAttachment(
  supabase: SupabaseClient<Database>,
  masterKey: CryptoKey,
  ownerId: string,
  capsuleId: string,
  file: File,
): Promise<CapsuleAttachment> {
  const attachmentId = crypto.randomUUID();
  const plaintext = new Uint8Array(await file.arrayBuffer());
  const { wrappedDocumentKey, payload }: EncryptedDocument = await encryptDocument(
    masterKey,
    plaintext,
  );

  const path = capsuleAttachmentStoragePath(ownerId, capsuleId, attachmentId);
  await uploadEncryptedCapsulePayload(supabase, path, serializeEnvelope(payload));

  return {
    id: attachmentId,
    filename: file.name,
    mimeType: file.type || "application/octet-stream",
    size: file.size,
    wrappedDocumentKey: serializeEnvelope(wrappedDocumentKey),
  };
}

/**
 * Encrypts title/content/attachments/openAt and creates a capsule in
 * "draft" status. Editable (see updateCapsule) only while still a draft
 * --- closing it (draft -> ready, see setCapsuleStatus) is irreversible.
 */
export async function createCapsule(
  supabase: SupabaseClient<Database>,
  masterKey: CryptoKey,
  ownerId: string,
  input: CapsuleInput,
): Promise<void> {
  const capsuleId = crypto.randomUUID();

  const attachments: CapsuleAttachment[] = [];
  try {
    for (const file of input.files) {
      attachments.push(await uploadAttachment(supabase, masterKey, ownerId, capsuleId, file));
    }
  } catch (err) {
    // Best-effort cleanup so a failed attachment doesn't leave orphaned blobs.
    await removeEncryptedCapsulePayloads(
      supabase,
      attachments.map((a) => capsuleAttachmentStoragePath(ownerId, capsuleId, a.id)),
    ).catch(() => {});
    throw err;
  }

  const payload: CapsulePayload = {
    title: input.title,
    content: input.content,
    attachments,
    linkedDocumentIds: input.linkedDocumentIds,
    relatedContactIds: input.relatedContactIds,
    openAt: input.openAt,
  };
  const encryptedPayload = await encryptBytes(masterKey, utf8ToBytes(JSON.stringify(payload)));

  const { error } = await supabase.from("capsules").insert({
    id: capsuleId,
    owner_id: ownerId,
    encrypted_payload: serializeEnvelope(encryptedPayload),
  });

  if (error) {
    await removeEncryptedCapsulePayloads(
      supabase,
      attachments.map((a) => capsuleAttachmentStoragePath(ownerId, capsuleId, a.id)),
    ).catch(() => {});
    throw new Error(`Impossibile creare la capsula: ${error.message}`);
  }
}

/**
 * Updates title/content/recipient while a capsule is still a draft ---
 * re-encrypts the whole payload (same shape as createCapsule), keeping
 * the existing attachments untouched: their ciphertext already lives in
 * Storage and isn't re-uploaded here.
 */
export async function updateCapsule(
  supabase: SupabaseClient<Database>,
  masterKey: CryptoKey,
  capsuleId: string,
  existingAttachments: CapsuleAttachment[],
  input: CapsuleEditInput,
): Promise<void> {
  const payload: CapsulePayload = {
    title: input.title,
    content: input.content,
    attachments: existingAttachments,
    linkedDocumentIds: input.linkedDocumentIds,
    relatedContactIds: input.relatedContactIds,
    openAt: input.openAt,
  };
  const encryptedPayload = await encryptBytes(masterKey, utf8ToBytes(JSON.stringify(payload)));

  const { error } = await supabase
    .from("capsules")
    .update({ encrypted_payload: serializeEnvelope(encryptedPayload) })
    .eq("id", capsuleId);

  if (error) {
    throw new Error(`Impossibile aggiornare la capsula: ${error.message}`);
  }
}

/**
 * Moves a capsule forward in its lifecycle (draft -> ready -> shared).
 * draft -> ready ("chiudi la capsula") is the one irreversible step:
 * once closed, the capsule stops being editable and any linked Documenti
 * entries can no longer be deleted from there (see deleteDocument).
 * "shared" beyond that is still just a recorded status change --- no
 * actual delivery or access grant to any recipient happens yet
 * (v. HINTHIAL_MVP.md: niente Dead Man's Switch in questa fase).
 */
export async function setCapsuleStatus(
  supabase: SupabaseClient<Database>,
  capsuleId: string,
  status: CapsuleStatus,
): Promise<void> {
  const { error } = await supabase.from("capsules").update({ status }).eq("id", capsuleId);

  if (error) {
    throw new Error(`Impossibile aggiornare lo stato della capsula: ${error.message}`);
  }
}

/** Downloads and decrypts one attachment's content client-side. */
export async function downloadCapsuleAttachment(
  supabase: SupabaseClient<Database>,
  masterKey: CryptoKey,
  ownerId: string,
  capsuleId: string,
  attachment: CapsuleAttachment,
): Promise<{ filename: string; mimeType: string; bytes: Uint8Array }> {
  const path = capsuleAttachmentStoragePath(ownerId, capsuleId, attachment.id);
  const serializedPayload = await downloadEncryptedCapsulePayload(supabase, path);

  const encrypted: EncryptedDocument = {
    wrappedDocumentKey: parseEnvelope(attachment.wrappedDocumentKey),
    payload: parseEnvelope(serializedPayload),
  };
  const bytes = await decryptDocument(masterKey, encrypted);

  return { filename: attachment.filename, mimeType: attachment.mimeType, bytes };
}

export async function deleteCapsule(
  supabase: SupabaseClient<Database>,
  ownerId: string,
  capsule: Pick<CapsuleListItem, "id" | "attachments">,
): Promise<void> {
  await removeEncryptedCapsulePayloads(
    supabase,
    capsule.attachments.map((a) => capsuleAttachmentStoragePath(ownerId, capsule.id, a.id)),
  );

  const { error } = await supabase.from("capsules").delete().eq("id", capsule.id);
  if (error) {
    throw new Error(`Impossibile eliminare la capsula: ${error.message}`);
  }
}
