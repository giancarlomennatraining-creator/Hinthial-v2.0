import type { SupabaseClient } from "@supabase/supabase-js";
import { getLocalUserId } from "@/lib/auth/local-user";
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
  bytesToBase64,
  base64ToBytes,
  exportKeyRaw,
  importKeyRaw,
  unwrapKey,
  unwrapPrivateKey,
  deriveSharedKeyAsSender,
  deriveSharedKeyAsRecipient,
  type EncryptedDocument,
} from "@/lib/crypto";
import {
  capsuleAttachmentStoragePath,
  downloadEncryptedCapsulePayload,
  removeEncryptedCapsulePayloads,
  uploadEncryptedCapsulePayload,
} from "@/lib/storage/capsules-bucket";
import { downloadDocument, getDocumentsByIds } from "@/domain/documents/repository";
import { getFriendsByIds, getLinkedFriendPublicKey } from "@/domain/friends/repository";
import { logAuditEvent } from "@/lib/audit/log-event";
import { encryptAuditLabel } from "@/lib/audit/label";
import { notifyCapsuleShared } from "@/lib/capsules/actions";
import type {
  CapsuleAccessCondition,
  CapsuleAttachment,
  CapsuleContentStyle,
  CapsuleEditInput,
  CapsuleInput,
  CapsuleListItem,
  CapsuleStatus,
  SharedCapsuleAttachment,
  SharedCapsuleListItem,
  SharedCapsuleOpenedContent,
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
  /** Assente nelle capsule create prima che questa scelta esistesse --- v. decryptPayload. */
  contentStyle: CapsuleContentStyle;
  attachments: CapsuleAttachment[];
  /** Ids of existing Documenti vault entries linked as attachments --- resolved via getDocumentsByIds. */
  linkedDocumentIds: string[];
  /** Ids of friends this capsule is meant for --- resolved via getFriendsByIds. */
  relatedFriendIds: string[];
  /** ISO datetime (UTC), or null --- see CapsuleListItem.openAt. */
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
    // Riprova al prossimo listCapsules().
  }
}

async function decryptPayload(masterKey: CryptoKey, row: CapsuleRow): Promise<CapsulePayload> {
  const payloadBytes = await decryptBytes(masterKey, parseEnvelope(row.encrypted_payload));
  const payload = JSON.parse(bytesToUtf8(payloadBytes)) as Partial<CapsulePayload>;
  return {
    title: payload.title ?? "",
    content: payload.content ?? "",
    contentStyle: payload.contentStyle ?? "simple",
    attachments: payload.attachments ?? [],
    linkedDocumentIds: payload.linkedDocumentIds ?? [],
    relatedFriendIds: payload.relatedFriendIds ?? [],
    openAt: payload.openAt ?? null,
  };
}

/** Capsule dell'utente corrente, più recenti prima; documenti/amici collegati risolti in una query batch ciascuno. */
export async function listCapsules(
  supabase: SupabaseClient<Database>,
  masterKey: CryptoKey,
): Promise<CapsuleListItem[]> {
  const userId = await getLocalUserId(supabase);
  if (!userId) return [];

  // Filtro esplicito, non solo RLS: esiste anche una policy che ammette le capsule condivise CON questo utente, non sue.
  const { data, error } = await supabase
    .from("capsules")
    .select(CAPSULE_COLUMNS)
    .eq("owner_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Impossibile caricare le capsule: ${error.message}`);
  }

  const rows = (data ?? []) as CapsuleRow[];
  const payloads = await Promise.all(rows.map((row) => decryptPayload(masterKey, row)));

  const allLinkedIds = [...new Set(payloads.flatMap((p) => p.linkedDocumentIds))];
  const allFriendIds = [...new Set(payloads.flatMap((p) => p.relatedFriendIds))];
  const [linkedDocuments, relatedFriends] = await Promise.all([
    getDocumentsByIds(supabase, masterKey, allLinkedIds),
    getFriendsByIds(supabase, masterKey, allFriendIds),
  ]);
  const linkedDocumentsById = new Map(linkedDocuments.map((doc) => [doc.id, doc]));
  const relatedFriendsById = new Map(relatedFriends.map((friend) => [friend.id, friend]));

  const items = rows.map((row, i) => {
    const payload = payloads[i];
    // La colonna in chiaro è la fonte autorevole; il payload cifrato è solo un fallback pre-migrazione (v. sanamento sotto).
    const openAt = row.open_at ?? payload.openAt;

    return {
      id: row.id,
      title: payload.title,
      content: payload.content,
      contentStyle: payload.contentStyle,
      attachments: payload.attachments,
      // Ids whose document/friend was since deleted resolve to nothing here --- filtered out on purpose.
      linkedDocuments: payload.linkedDocumentIds
        .map((id) => linkedDocumentsById.get(id))
        .filter((doc): doc is NonNullable<typeof doc> => doc !== undefined),
      relatedFriends: payload.relatedFriendIds
        .map((id) => relatedFriendsById.get(id))
        .filter((friend): friend is NonNullable<typeof friend> => friend !== undefined),
      status: row.status,
      accessCondition: row.access_condition,
      openAt,
      createdAt: row.created_at,
    };
  });

  // Sanamento best-effort: riporta in chiaro open_at per le capsule pre-migrazione, alla prima occasione utile.
  for (const [i, row] of rows.entries()) {
    if (row.open_at === null && payloads[i].openAt !== null) {
      void backfillOpenAtColumn(supabase, row.id, payloads[i].openAt as string);
    }
  }

  return items;
}

/** Cifra e carica un allegato (Document Key propria, come FASE 4); il testo cifrato vive solo in Storage. */
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

/** Crea una capsula in stato "draft"; editabile solo finché resta tale, chiuderla (v. closeCapsule) è irreversibile. */
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
    contentStyle: input.contentStyle,
    attachments,
    linkedDocumentIds: input.linkedDocumentIds,
    relatedFriendIds: input.relatedFriendIds,
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

  await logAuditEvent(supabase, ownerId, "capsule_created", undefined, { type: "capsule", id: capsuleId });
}

/** Aggiorna una capsula ancora draft, ricifrando l'intero payload; `removedAttachments` viene rimosso da Storage solo dopo il salvataggio, non prima. */
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
    contentStyle: input.contentStyle,
    attachments: [...keptAttachments, ...uploadedAttachments],
    linkedDocumentIds: input.linkedDocumentIds,
    relatedFriendIds: input.relatedFriendIds,
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
    // Best-effort: il payload nuovo è già salvato, un fallimento qui lascia solo blob orfani in Storage.
    await removeEncryptedCapsulePayloads(
      supabase,
      removedAttachments.map((a) => capsuleAttachmentStoragePath(ownerId, capsuleId, a.id)),
    ).catch(() => {});
  }

  await logAuditEvent(supabase, ownerId, "capsule_updated", undefined, { type: "capsule", id: capsuleId });
}

/** Chiude una capsula (draft -> ready, irreversibile): ogni Archivio collegato viene copiato con una Document Key propria, così la capsula non dipende più dagli originali. Tutto o niente: un fallimento a metà rimuove le copie e lascia la capsula com'era. */
export async function closeCapsule(
  supabase: SupabaseClient<Database>,
  masterKey: CryptoKey,
  ownerId: string,
  capsule: Pick<CapsuleListItem, "id" | "title" | "content" | "contentStyle" | "attachments" | "linkedDocuments" | "relatedFriends" | "openAt">,
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
    contentStyle: capsule.contentStyle,
    attachments: [...capsule.attachments, ...newAttachments],
    // Tutto ciò che era un riferimento è ora una copia propria.
    linkedDocumentIds: [],
    relatedFriendIds: capsule.relatedFriends.map((c) => c.id),
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

/** Cambio di stato registrato, nient'altro --- v. shareCapsule per il vero significato di "Condividi", che lo usa internamente. */
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

/** Prepara il contenuto per un destinatario: Document Key in chiaro qui (v. SharedCapsuleAttachment), non avvolta --- il destinatario non ha la Master Key del proprietario. */
async function buildRecipientPayload(
  masterKey: CryptoKey,
  capsule: Pick<CapsuleListItem, "title" | "content" | "contentStyle" | "attachments">,
): Promise<SharedCapsuleOpenedContent> {
  const attachments: SharedCapsuleAttachment[] = await Promise.all(
    capsule.attachments.map(async (attachment) => {
      const documentKey = await unwrapKey(masterKey, parseEnvelope(attachment.wrappedDocumentKey), true);
      const raw = await exportKeyRaw(documentKey);
      return {
        id: attachment.id,
        filename: attachment.filename,
        mimeType: attachment.mimeType,
        size: attachment.size,
        documentKeyRaw: bytesToBase64(raw),
        transcript: attachment.transcript,
      };
    }),
  );

  return { title: capsule.title, content: capsule.content, contentStyle: capsule.contentStyle, attachments };
}

/** FASE C1: crea/rinnova la busta ECDH che permette a un destinatario collegato di decifrare la capsula dopo l'apertura. Best-effort e silenzioso se il destinatario non ha ancora una chiave pubblica --- nessun retry automatico, limite noto. */
async function createOrRefreshShareKey(
  supabase: SupabaseClient<Database>,
  masterKey: CryptoKey,
  ownerId: string,
  capsule: Pick<CapsuleListItem, "id" | "title" | "content" | "contentStyle" | "attachments">,
  friendId: string,
  recipientUserId: string,
): Promise<void> {
  try {
    const recipientPublicKeyJwk = await getLinkedFriendPublicKey(supabase, friendId);
    if (!recipientPublicKeyJwk) return;

    const [{ sharedKey, ephemeralPublicKeyJwk }, recipientPayload] = await Promise.all([
      deriveSharedKeyAsSender(recipientPublicKeyJwk),
      buildRecipientPayload(masterKey, capsule),
    ]);
    const encryptedPayloadForRecipient = await encryptBytes(
      sharedKey,
      utf8ToBytes(JSON.stringify(recipientPayload)),
    );

    const { error } = await supabase.from("capsule_share_keys").upsert(
      {
        capsule_id: capsule.id,
        owner_id: ownerId,
        recipient_user_id: recipientUserId,
        ephemeral_public_key: ephemeralPublicKeyJwk,
        encrypted_payload_for_recipient: serializeEnvelope(encryptedPayloadForRecipient),
      },
      { onConflict: "capsule_id,recipient_user_id" },
    );
    if (error) throw error;
  } catch {
    // Best-effort --- v. commento sopra.
  }
}

/** FASE B/C1: "Condividi" crea sia il legame verso "Condivise con me" sia la busta cifrata (v. createOrRefreshShareKey) per ogni destinatario già collegato; chi non è ancora collegato viene agganciato in seguito (v. syncCapsuleSharesForLinkedFriend). */
export async function shareCapsule(
  supabase: SupabaseClient<Database>,
  masterKey: CryptoKey,
  ownerId: string,
  capsule: Pick<CapsuleListItem, "id" | "title" | "content" | "contentStyle" | "attachments" | "relatedFriends">,
): Promise<void> {
  const linkedFriends = capsule.relatedFriends.filter((friend) => friend.linkedUserId !== null);

  for (const friend of linkedFriends) {
    await createOrRefreshShareKey(supabase, masterKey, ownerId, capsule, friend.id, friend.linkedUserId as string);
  }

  if (linkedFriends.length > 0) {
    const { error } = await supabase.from("capsule_shares").upsert(
      linkedFriends.map((friend) => ({
        capsule_id: capsule.id,
        owner_id: ownerId,
        recipient_user_id: friend.linkedUserId as string,
      })),
      { onConflict: "capsule_id,recipient_user_id" },
    );

    if (error) {
      throw new Error(`Impossibile condividere la capsula: ${error.message}`);
    }

    for (const friend of linkedFriends) {
      void notifyCapsuleShared(friend.linkedUserId as string);
    }
  }

  await setCapsuleStatus(supabase, capsule.id, "shared");
}

/** Retroattivo: quando un amico si collega dopo che una capsula era già condivisa con lui, crea qui il legame e la busta mancanti (v. createOrRefreshShareKey). `sharedCapsules` arriva già filtrata a status "shared" dal chiamante. */
export async function syncCapsuleSharesForLinkedFriend(
  supabase: SupabaseClient<Database>,
  masterKey: CryptoKey,
  ownerId: string,
  friendId: string,
  linkedUserId: string,
  sharedCapsules: Pick<CapsuleListItem, "id" | "title" | "content" | "contentStyle" | "attachments" | "relatedFriends">[],
): Promise<void> {
  const relevant = sharedCapsules.filter((c) => c.relatedFriends.some((f) => f.id === friendId));
  if (relevant.length === 0) return;

  for (const capsule of relevant) {
    await createOrRefreshShareKey(supabase, masterKey, ownerId, capsule, friendId, linkedUserId);
  }

  const { error } = await supabase.from("capsule_shares").upsert(
    relevant.map((c) => ({ capsule_id: c.id, owner_id: ownerId, recipient_user_id: linkedUserId })),
    { onConflict: "capsule_id,recipient_user_id" },
  );

  if (error) {
    throw new Error(`Impossibile collegare le capsule già condivise: ${error.message}`);
  }

  void notifyCapsuleShared(linkedUserId);
}

/** FASE B: capsule condivise con l'utente da altri --- solo metadati in chiaro (v. SharedCapsuleListItem), titolo/contenuto restano cifrati con la Master Key del proprietario. */
export async function listCapsulesSharedWithMe(
  supabase: SupabaseClient<Database>,
): Promise<SharedCapsuleListItem[]> {
  const userId = await getLocalUserId(supabase);
  if (!userId) return [];

  // Filtro esplicito: la policy RLS ammette sia proprietario sia destinatario, senza questo un condivisore la ritroverebbe qui.
  const { data: shares, error: sharesError } = await supabase
    .from("capsule_shares")
    .select("capsule_id, owner_id, shared_at, dismissed_at")
    .eq("recipient_user_id", userId)
    .order("shared_at", { ascending: false });

  if (sharesError) {
    throw new Error(`Impossibile caricare le capsule condivise: ${sharesError.message}`);
  }
  if (!shares || shares.length === 0) return [];

  const capsuleIds = [...new Set(shares.map((s) => s.capsule_id))];
  const ownerIds = [...new Set(shares.map((s) => s.owner_id))];

  const [capsulesResult, profilesResult] = await Promise.all([
    supabase.from("capsules").select("id, status, open_at").in("id", capsuleIds),
    supabase.from("profiles").select("id, first_name, last_name").in("id", ownerIds),
  ]);

  if (capsulesResult.error) {
    throw new Error(`Impossibile caricare le capsule condivise: ${capsulesResult.error.message}`);
  }
  if (profilesResult.error) {
    throw new Error(`Impossibile caricare i mittenti: ${profilesResult.error.message}`);
  }

  const capsulesById = new Map((capsulesResult.data ?? []).map((c) => [c.id, c]));
  const profilesById = new Map((profilesResult.data ?? []).map((p) => [p.id, p]));

  return shares
    .map((share): SharedCapsuleListItem | null => {
      const capsule = capsulesById.get(share.capsule_id);
      const profile = profilesById.get(share.owner_id);
      if (!capsule || !profile) return null;

      return {
        id: share.capsule_id,
        ownerId: share.owner_id,
        ownerName: `${profile.first_name} ${profile.last_name}`.trim(),
        sharedAt: share.shared_at,
        status: capsule.status,
        openAt: capsule.open_at,
        dismissedAt: share.dismissed_at,
      };
    })
    .filter((item): item is SharedCapsuleListItem => item !== null);
}

/** Chiude il popup di notifica per questa capsula condivisa, per sempre --- solo un promemoria lato server, nessun ruolo di sicurezza. */
export async function dismissCapsuleShareNotification(
  supabase: SupabaseClient<Database>,
  capsuleId: string,
): Promise<void> {
  const { error } = await supabase
    .from("capsule_shares")
    .update({ dismissed_at: new Date().toISOString() })
    .eq("capsule_id", capsuleId);
  if (error) {
    throw new Error(`Impossibile chiudere la notifica: ${error.message}`);
  }
}

/** FASE C1: sblocca la propria chiave privata, ridriva la chiave condivisa ECDH e decifra --- visibile solo dopo la data di apertura. */
export async function openSharedCapsule(
  supabase: SupabaseClient<Database>,
  masterKey: CryptoKey,
  capsuleId: string,
): Promise<SharedCapsuleOpenedContent> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Devi essere autenticato.");

  const [setupResult, shareKeyResult] = await Promise.all([
    supabase.from("encryption_setup").select("wrapped_private_key").eq("owner_id", user.id).single(),
    supabase
      .from("capsule_share_keys")
      .select("ephemeral_public_key, encrypted_payload_for_recipient")
      .eq("capsule_id", capsuleId)
      .eq("recipient_user_id", user.id)
      .single(),
  ]);

  if (setupResult.error || !setupResult.data?.wrapped_private_key) {
    throw new Error("La tua chiave di decifratura non è ancora pronta. Riprova dopo aver sbloccato di nuovo Hinthial.");
  }
  if (shareKeyResult.error || !shareKeyResult.data) {
    throw new Error("Questa capsula non è ancora apribile: non è la data di apertura, oppure la chiave non è ancora arrivata.");
  }

  const privateKey = await unwrapPrivateKey(masterKey, parseEnvelope(setupResult.data.wrapped_private_key));
  const sharedKey = await deriveSharedKeyAsRecipient(privateKey, shareKeyResult.data.ephemeral_public_key);
  const plaintext = await decryptBytes(
    sharedKey,
    parseEnvelope(shareKeyResult.data.encrypted_payload_for_recipient),
  );

  return JSON.parse(bytesToUtf8(plaintext)) as SharedCapsuleOpenedContent;
}

/** A differenza di downloadCapsuleAttachment, qui la Document Key è già in chiaro nell'allegato (v. SharedCapsuleAttachment): basta importarla. */
export async function downloadSharedCapsuleAttachment(
  supabase: SupabaseClient<Database>,
  ownerId: string,
  capsuleId: string,
  attachment: SharedCapsuleAttachment,
): Promise<{ filename: string; mimeType: string; bytes: Uint8Array }> {
  const path = capsuleAttachmentStoragePath(ownerId, capsuleId, attachment.id);
  const serializedPayload = await downloadEncryptedCapsulePayload(supabase, path);

  const documentKey = await importKeyRaw(base64ToBytes(attachment.documentKeyRaw));
  const bytes = await decryptBytes(documentKey, parseEnvelope(serializedPayload));

  return { filename: attachment.filename, mimeType: attachment.mimeType, bytes };
}

/** Ricifra l'intero payload come updateCapsule, ma tocca solo il transcript di un allegato --- permesso a prescindere dallo stato, non cambia cosa contiene la capsula. */
export async function updateCapsuleAttachmentTranscript(
  supabase: SupabaseClient<Database>,
  masterKey: CryptoKey,
  capsule: Pick<
    CapsuleListItem,
    "id" | "title" | "content" | "contentStyle" | "attachments" | "linkedDocuments" | "relatedFriends" | "openAt"
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
    contentStyle: capsule.contentStyle,
    attachments,
    linkedDocumentIds: capsule.linkedDocuments.map((d) => d.id),
    relatedFriendIds: capsule.relatedFriends.map((c) => c.id),
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
  masterKey: CryptoKey,
  ownerId: string,
  capsule: Pick<CapsuleListItem, "id" | "title" | "attachments">,
): Promise<void> {
  // Il titolo sta dentro il payload cifrato: lo si cifra di nuovo per l'evento, per riconoscere la capsula dopo l'eliminazione.
  const encryptedLabel = await encryptAuditLabel(masterKey, capsule.title);

  await removeEncryptedCapsulePayloads(
    supabase,
    capsule.attachments.map((a) => capsuleAttachmentStoragePath(ownerId, capsule.id, a.id)),
  );

  const { error } = await supabase.from("capsules").delete().eq("id", capsule.id);
  if (error) {
    throw new Error(`Impossibile eliminare la capsula: ${error.message}`);
  }

  await logAuditEvent(supabase, ownerId, "capsule_deleted", undefined, {
    type: "capsule",
    id: capsule.id,
    encryptedLabel,
  });
}
