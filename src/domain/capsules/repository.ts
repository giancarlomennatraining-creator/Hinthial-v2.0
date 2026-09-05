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
import { downloadDocument, getDocumentsByIds } from "@/domain/documents/repository";
import { getTrustedContactsByIds } from "@/domain/contacts/repository";
import type {
  CapsuleAccessCondition,
  CapsuleAttachment,
  CapsuleEditInput,
  CapsuleInput,
  CapsuleListItem,
  CapsuleStatus,
} from "@/domain/capsules/types";

const CAPSULE_COLUMNS = "id, encrypted_payload, status, access_condition, open_at, created_at";

type CapsuleRow = {
  id: string;
  encrypted_payload: string;
  status: CapsuleStatus;
  access_condition: CapsuleAccessCondition;
  /** In chiaro apposta --- v. migrazione 20260905000000 e CapsuleListItem.openAt. */
  open_at: string | null;
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

/** Best-effort, mai atteso dal chiamante --- v. listCapsules. */
async function backfillOpenAtColumn(
  supabase: SupabaseClient<Database>,
  capsuleId: string,
  openAt: string,
): Promise<void> {
  try {
    await supabase.from("capsules").update({ open_at: openAt }).eq("id", capsuleId);
  } catch {
    // Riprova al prossimo listCapsules() --- nessun dato perso, solo non ancora sanato.
  }
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

  const items = rows.map((row, i) => {
    const payload = payloads[i];
    // La colonna in chiaro è la fonte autorevole (v. migrazione
    // 20260905000000); il payload cifrato resta un fallback per le
    // capsule create prima che esistesse --- v. sanamento sotto.
    const openAt = row.open_at ?? payload.openAt;

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
      openAt,
      createdAt: row.created_at,
    };
  });

  // Sanamento: una capsula creata prima della migrazione ha open_at
  // NULL a livello di colonna anche se il payload cifrato ha già una
  // data --- la si riporta in chiaro qui, alla prima occasione in cui
  // il proprietario la rivede (unico momento in cui è già decifrata).
  // Best-effort: un fallimento qui non deve impedire di mostrare la lista.
  for (const [i, row] of rows.entries()) {
    if (row.open_at === null && payloads[i].openAt !== null) {
      // Non attesa di proposito: un fallimento qui riprova semplicemente
      // al prossimo caricamento, non deve rallentare né bloccare la lista.
      void backfillOpenAtColumn(supabase, row.id, payloads[i].openAt as string);
    }
  }

  return items;
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
 * --- closing it (draft -> ready, see closeCapsule) is irreversible.
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
    open_at: input.openAt,
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
 * Updates title/content/recipients/attachments while a capsule is still
 * a draft --- re-encrypts the whole payload (same shape as
 * createCapsule). `keptAttachments` are existing attachments left
 * untouched (their ciphertext already lives in Storage, not
 * re-uploaded); `input.newFiles` are freshly recorded/uploaded
 * audio/video, encrypted and uploaded here exactly like createCapsule;
 * `removedAttachments` are existing ones the caller dropped --- their
 * Storage blobs are deleted, but only *after* the new payload is
 * confirmed saved (deleting first and then failing to save would leave
 * the still-current payload pointing at now-missing attachments).
 */
export async function updateCapsule(
  supabase: SupabaseClient<Database>,
  masterKey: CryptoKey,
  ownerId: string,
  capsuleId: string,
  keptAttachments: CapsuleAttachment[],
  removedAttachments: CapsuleAttachment[],
  input: CapsuleEditInput,
): Promise<void> {
  const uploadedAttachments: CapsuleAttachment[] = [];
  try {
    for (const file of input.newFiles) {
      uploadedAttachments.push(await uploadAttachment(supabase, masterKey, ownerId, capsuleId, file));
    }
  } catch (err) {
    await removeEncryptedCapsulePayloads(
      supabase,
      uploadedAttachments.map((a) => capsuleAttachmentStoragePath(ownerId, capsuleId, a.id)),
    ).catch(() => {});
    throw err instanceof Error
      ? new Error(`Impossibile aggiornare la capsula: ${err.message}`)
      : new Error("Impossibile aggiornare la capsula.");
  }

  const payload: CapsulePayload = {
    title: input.title,
    content: input.content,
    attachments: [...keptAttachments, ...uploadedAttachments],
    linkedDocumentIds: input.linkedDocumentIds,
    relatedContactIds: input.relatedContactIds,
    openAt: input.openAt,
  };
  const encryptedPayload = await encryptBytes(masterKey, utf8ToBytes(JSON.stringify(payload)));

  const { error } = await supabase
    .from("capsules")
    .update({ encrypted_payload: serializeEnvelope(encryptedPayload), open_at: input.openAt })
    .eq("id", capsuleId);

  if (error) {
    await removeEncryptedCapsulePayloads(
      supabase,
      uploadedAttachments.map((a) => capsuleAttachmentStoragePath(ownerId, capsuleId, a.id)),
    ).catch(() => {});
    throw new Error(`Impossibile aggiornare la capsula: ${error.message}`);
  }

  if (removedAttachments.length > 0) {
    // Best-effort: il payload nuovo (senza questi allegati) è già
    // salvato, quindi un fallimento qui lascia solo blob orfani in
    // Storage --- non un problema di correttezza, nessun riferimento li punta più.
    await removeEncryptedCapsulePayloads(
      supabase,
      removedAttachments.map((a) => capsuleAttachmentStoragePath(ownerId, capsuleId, a.id)),
    ).catch(() => {});
  }
}

/**
 * Closes a capsule (draft -> ready) --- the one irreversible step, and
 * from FASE 14 more than a status flip: every Archivio item still
 * linked (capsule.linkedDocuments) is decrypted and re-encrypted with
 * its own fresh Document Key, exactly like a directly-uploaded
 * attachment (see uploadAttachment above). From this point on the
 * capsule owns a private copy of everything inside it --- it no longer
 * depends on those Archivio originals staying untouched, so nothing
 * needs to lock them against deletion/editing anymore.
 *
 * If copying any item fails partway through, the newly-uploaded copies
 * are removed and the capsule is left exactly as it was (still a
 * draft, still referencing the originals) --- an all-or-nothing step,
 * same spirit as createCapsule's own cleanup-on-failure.
 */
export async function closeCapsule(
  supabase: SupabaseClient<Database>,
  masterKey: CryptoKey,
  ownerId: string,
  capsule: Pick<CapsuleListItem, "id" | "title" | "content" | "attachments" | "linkedDocuments" | "relatedContacts" | "openAt">,
): Promise<void> {
  const newAttachments: CapsuleAttachment[] = [];
  try {
    for (const doc of capsule.linkedDocuments) {
      const { bytes } = await downloadDocument(supabase, masterKey, doc);
      const attachmentId = crypto.randomUUID();
      const { wrappedDocumentKey, payload }: EncryptedDocument = await encryptDocument(
        masterKey,
        new Uint8Array(bytes),
      );

      const path = capsuleAttachmentStoragePath(ownerId, capsule.id, attachmentId);
      await uploadEncryptedCapsulePayload(supabase, path, serializeEnvelope(payload));

      newAttachments.push({
        id: attachmentId,
        filename: doc.filename,
        mimeType: doc.mimeType,
        size: doc.size,
        wrappedDocumentKey: serializeEnvelope(wrappedDocumentKey),
      });
    }
  } catch (err) {
    await removeEncryptedCapsulePayloads(
      supabase,
      newAttachments.map((a) => capsuleAttachmentStoragePath(ownerId, capsule.id, a.id)),
    ).catch(() => {});
    throw err instanceof Error
      ? new Error(`Impossibile chiudere la capsula: ${err.message}`)
      : new Error("Impossibile chiudere la capsula.");
  }

  const payload: CapsulePayload = {
    title: capsule.title,
    content: capsule.content,
    attachments: [...capsule.attachments, ...newAttachments],
    // Tutto ciò che era un riferimento è ora una copia propria: la capsula chiusa non ne ha più bisogno.
    linkedDocumentIds: [],
    relatedContactIds: capsule.relatedContacts.map((c) => c.id),
    openAt: capsule.openAt,
  };
  const encryptedPayload = await encryptBytes(masterKey, utf8ToBytes(JSON.stringify(payload)));

  const { error } = await supabase
    .from("capsules")
    .update({
      encrypted_payload: serializeEnvelope(encryptedPayload),
      status: "ready" satisfies CapsuleStatus,
    })
    .eq("id", capsule.id);

  if (error) {
    await removeEncryptedCapsulePayloads(
      supabase,
      newAttachments.map((a) => capsuleAttachmentStoragePath(ownerId, capsule.id, a.id)),
    ).catch(() => {});
    throw new Error(`Impossibile chiudere la capsula: ${error.message}`);
  }
}

/**
 * Moves a capsule forward in its lifecycle beyond closing (ready ->
 * shared) --- still just a recorded status change, no actual delivery
 * or access grant to any recipient happens yet (v. HINTHIAL_MVP.md:
 * niente Dead Man's Switch in questa fase). draft -> ready goes through
 * closeCapsule instead, which does real work beyond the status itself.
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

/**
 * Updates one attachment's transcript (audio/video only, written by
 * hand today --- v. domain/transcription). Re-encrypts the whole
 * payload like updateCapsule, but touches only this one attachment's
 * field --- allowed regardless of status: it doesn't change what the
 * capsule actually contains, only a searchable annotation alongside it,
 * so it doesn't compromise "closing is irreversible".
 */
export async function updateCapsuleAttachmentTranscript(
  supabase: SupabaseClient<Database>,
  masterKey: CryptoKey,
  capsule: Pick<
    CapsuleListItem,
    "id" | "title" | "content" | "attachments" | "linkedDocuments" | "relatedContacts" | "openAt"
  >,
  attachmentId: string,
  transcript: string,
): Promise<void> {
  const trimmed = transcript.trim();
  const attachments = capsule.attachments.map((a) =>
    a.id === attachmentId ? { ...a, transcript: trimmed || undefined } : a,
  );

  const payload: CapsulePayload = {
    title: capsule.title,
    content: capsule.content,
    attachments,
    linkedDocumentIds: capsule.linkedDocuments.map((d) => d.id),
    relatedContactIds: capsule.relatedContacts.map((c) => c.id),
    openAt: capsule.openAt,
  };
  const encryptedPayload = await encryptBytes(masterKey, utf8ToBytes(JSON.stringify(payload)));

  const { error } = await supabase
    .from("capsules")
    .update({ encrypted_payload: serializeEnvelope(encryptedPayload) })
    .eq("id", capsule.id);

  if (error) {
    throw new Error(`Impossibile salvare la trascrizione: ${error.message}`);
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
