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
  documentStoragePath,
  documentThumbnailPath,
  downloadEncryptedPayload,
  downloadOptionalEncryptedPayload,
  removeEncryptedPayload,
  uploadEncryptedPayload,
  uploadEncryptedThumbnail,
} from "@/lib/storage/documents-bucket";
import { logAuditEvent } from "@/lib/audit/log-event";
import { computePurgeAt } from "@/domain/documents/trash";
import { listDossierIdsForDocuments, replaceDocumentDossierLinks } from "@/domain/dossiers/repository";
import { NOTE_MIME_TYPE } from "@/lib/content-kind";
import { canExtractText, extractText } from "@/domain/extraction/extract-text";
import { canHaveThumbnail, createThumbnail } from "@/lib/thumbnail";
import type {
  DocumentListItem,
  DocumentMetadataInput,
  TextNoteInput,
} from "@/domain/documents/types";

/**
 * Le fasi visibili di un caricamento --- v. uploadDocument, `onPhase`.
 * "reading" può durare qualche secondo su un PDF lungo, e parecchi di
 * più sull'OCR di una foto: dirlo è l'unica differenza tra un'attesa
 * spiegata e una inspiegata.
 */
export type UploadPhase = "reading" | "saving";

/**
 * Notifica di avanzamento: la fase in corso e, quando il motore sa
 * stimarlo, quanto manca (0-1). `null` significa "non stimabile", non
 * "zero" --- chi lo riceve deve mostrare un'attesa senza percentuale,
 * non una percentuale ferma a 0 (v. FASE 17c).
 */
export type UploadPhaseListener = (phase: UploadPhase, progress: number | null) => void;

/**
 * FASE 19b --- il risultato di una lettura già fatta altrove.
 *
 * Dal momento in cui il form legge il documento appena lo scegli (per
 * poter proporre titolo, categoria e scadenza *prima* di salvare),
 * rileggerlo al salvataggio sarebbe lavoro rifatto due volte --- su una
 * scansione significa mezzo minuto buttato.
 *
 * `attempted: false` è il caso in cui l'utente ha premuto Salva mentre
 * la lettura era ancora in corso: si salva subito e `extracted_at`
 * resta nullo, così il documento finisce tra quelli che l'avviso
 * "Leggili ora" recupera (v. FASE 17b). Salvare non deve mai aspettare.
 */
export interface PriorExtraction {
  text: string | null;
  attempted: boolean;
}

export interface UploadOptions {
  /** Il nome con cui salvare il contenuto --- di default quello del file. */
  title?: string;
  /** Una lettura già fatta; se assente, si legge qui. */
  extraction?: PriorExtraction;
  onPhase?: UploadPhaseListener;
}

const DOCUMENT_COLUMNS =
  "id, encrypted_filename, wrapped_document_key, storage_path, mime_type, size, category_id, related_asset_id, expires_at, encrypted_notes, encrypted_tags, encrypted_issuer, encrypted_transcript, encrypted_extracted_text, extracted_at, has_thumbnail, deleted_at, purge_at, created_at";

type DocumentRow = {
  id: string;
  encrypted_filename: string;
  wrapped_document_key: string;
  storage_path: string;
  mime_type: string;
  size: number;
  category_id: string | null;
  related_asset_id: string | null;
  expires_at: string | null;
  encrypted_notes: string | null;
  encrypted_tags: string | null;
  encrypted_issuer: string | null;
  encrypted_transcript: string | null;
  encrypted_extracted_text: string | null;
  extracted_at: string | null;
  has_thumbnail: boolean;
  deleted_at: string | null;
  purge_at: string | null;
  created_at: string;
};

/** null/empty in -> null out: nothing to encrypt, nothing stored. */
async function encryptOptionalText(
  masterKey: CryptoKey,
  text: string,
): Promise<string | null> {
  if (!text.trim()) return null;
  return serializeEnvelope(await encryptBytes(masterKey, utf8ToBytes(text)));
}

async function decryptOptionalText(
  masterKey: CryptoKey,
  serialized: string | null,
): Promise<string> {
  if (!serialized) return "";
  const bytes = await decryptBytes(masterKey, parseEnvelope(serialized));
  return bytesToUtf8(bytes);
}

async function encryptTags(masterKey: CryptoKey, tags: string[]): Promise<string | null> {
  if (tags.length === 0) return null;
  return serializeEnvelope(await encryptBytes(masterKey, utf8ToBytes(JSON.stringify(tags))));
}

async function decryptTags(masterKey: CryptoKey, serialized: string | null): Promise<string[]> {
  if (!serialized) return [];
  const bytes = await decryptBytes(masterKey, parseEnvelope(serialized));
  const parsed: unknown = JSON.parse(bytesToUtf8(bytes));
  return Array.isArray(parsed) ? parsed.filter((t): t is string => typeof t === "string") : [];
}

async function toDocumentListItem(
  masterKey: CryptoKey,
  row: DocumentRow,
  dossierIds: string[],
): Promise<DocumentListItem> {
  const [filenameBytes, notes, tags, issuer, transcript, extractedText] = await Promise.all([
    decryptBytes(masterKey, parseEnvelope(row.encrypted_filename)),
    decryptOptionalText(masterKey, row.encrypted_notes),
    decryptTags(masterKey, row.encrypted_tags),
    decryptOptionalText(masterKey, row.encrypted_issuer),
    decryptOptionalText(masterKey, row.encrypted_transcript),
    decryptOptionalText(masterKey, row.encrypted_extracted_text),
  ]);

  return {
    id: row.id,
    filename: bytesToUtf8(filenameBytes),
    mimeType: row.mime_type,
    size: row.size,
    categoryId: row.category_id,
    relatedAssetId: row.related_asset_id,
    dossierIds,
    createdAt: row.created_at,
    storagePath: row.storage_path,
    wrappedDocumentKey: row.wrapped_document_key,
    expiresAt: row.expires_at,
    notes,
    tags,
    issuer,
    transcript,
    extractedText,
    extractedAt: row.extracted_at,
    hasThumbnail: row.has_thumbnail,
    deletedAt: row.deleted_at,
    purgeAt: row.purge_at,
  };
}

/** null in -> null out: nessuna miniatura da cifrare. */
async function encryptThumbnail(masterKey: CryptoKey, thumbnail: Blob | null): Promise<string | null> {
  if (!thumbnail) return null;
  const bytes = new Uint8Array(await thumbnail.arrayBuffer());
  return serializeEnvelope(await encryptBytes(masterKey, bytes));
}

/**
 * Lists the current user's documents, decrypting each filename/notes/
 * tags client-side with the (already unlocked) Master Key. The server
 * only ever returns ciphertext; decryption happens here, not on the
 * server. Un documento nel Cestino (v. moveDocumentsToTrash) non
 * compare qui --- altrimenti "quanti documenti ho" diventerebbe
 * ambiguo --- ma resta trovabile da listTrashedDocuments qui sotto.
 */
export async function listDocuments(
  supabase: SupabaseClient<Database>,
  masterKey: CryptoKey,
): Promise<DocumentListItem[]> {
  const { data, error } = await supabase
    .from("documents")
    .select(DOCUMENT_COLUMNS)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Impossibile caricare i documenti: ${error.message}`);
  }

  const rows = data ?? [];
  const dossierIdsByDocument = await listDossierIdsForDocuments(supabase, rows.map((row) => row.id));

  return Promise.all(
    rows.map((row) => toDocumentListItem(masterKey, row, dossierIdsByDocument.get(row.id) ?? [])),
  );
}

/** Solo i documenti nel Cestino --- v. moveDocumentsToTrash/restoreDocuments. Ordinati dal più recente eliminato, non da quando erano stati creati. */
export async function listTrashedDocuments(
  supabase: SupabaseClient<Database>,
  masterKey: CryptoKey,
): Promise<DocumentListItem[]> {
  const { data, error } = await supabase
    .from("documents")
    .select(DOCUMENT_COLUMNS)
    .not("deleted_at", "is", null)
    .order("deleted_at", { ascending: false });

  if (error) {
    throw new Error(`Impossibile caricare il cestino: ${error.message}`);
  }

  const rows = data ?? [];
  const dossierIdsByDocument = await listDossierIdsForDocuments(supabase, rows.map((row) => row.id));

  return Promise.all(
    rows.map((row) => toDocumentListItem(masterKey, row, dossierIdsByDocument.get(row.id) ?? [])),
  );
}

/**
 * Fetches a specific set of documents by id (e.g. capsule attachments
 * linking to existing vault documents, FASE 8), decrypting each client-
 * side. Ids that no longer exist (or belong to someone else, filtered
 * out by RLS) are silently omitted --- callers should treat a shorter
 * result as "some referenced documents are gone", not an error.
 */
export async function getDocumentsByIds(
  supabase: SupabaseClient<Database>,
  masterKey: CryptoKey,
  ids: string[],
): Promise<DocumentListItem[]> {
  if (ids.length === 0) return [];

  const { data, error } = await supabase.from("documents").select(DOCUMENT_COLUMNS).in("id", ids);

  if (error) {
    throw new Error(`Impossibile caricare i documenti collegati: ${error.message}`);
  }

  const rows = data ?? [];
  const dossierIdsByDocument = await listDossierIdsForDocuments(supabase, rows.map((row) => row.id));

  return Promise.all(
    rows.map((row) => toDocumentListItem(masterKey, row, dossierIdsByDocument.get(row.id) ?? [])),
  );
}

/**
 * Encrypts `file` client-side (content under a fresh Document Key,
 * filename/notes/tags under the Master Key directly) and uploads only
 * ciphertext: the payload to Storage, everything else to the
 * `documents` row. The server never sees the plaintext file or any of
 * this metadata.
 */
export async function uploadDocument(
  supabase: SupabaseClient<Database>,
  masterKey: CryptoKey,
  ownerId: string,
  file: File,
  metadata: DocumentMetadataInput,
  options: UploadOptions = {},
): Promise<void> {
  const { title, extraction, onPhase } = options;
  const plaintext = new Uint8Array(await file.arrayBuffer());
  const mimeType = file.type || "application/octet-stream";

  // FASE 17 --- il testo si ricava QUI, dove il contenuto è ancora in
  // chiaro in memoria: nessun download né decifratura in più, e nulla
  // lascia il dispositivo (v. domain/extraction). Best-effort: se
  // l'estrazione non riesce si salva il documento lo stesso, si perde
  // solo la possibilità di cercarci dentro.
  //
  // `onPhase` esiste perché leggere un PDF lungo richiede qualche
  // secondo: senza, l'interfaccia direbbe "Salvataggio…" mentre in
  // realtà sta leggendo (v. FASE 17b, richiesta utente). L'OCR di una
  // foto ne richiede molti di più, e per quello riporta anche una
  // percentuale (v. FASE 17c).
  // Se il form ha già letto il documento (v. PriorExtraction) si usa
  // quel risultato: rileggere sarebbe lo stesso lavoro due volte.
  let extractedText: string | null;
  let attempted: boolean;
  if (extraction) {
    extractedText = extraction.text;
    attempted = extraction.attempted;
  } else {
    attempted = canExtractText(mimeType);
    if (attempted) onPhase?.("reading", null);
    extractedText = await extractText(plaintext, mimeType, (fraction) =>
      onPhase?.("reading", fraction),
    );
  }

  // La miniatura si genera QUI per lo stesso motivo del testo estratto:
  // il contenuto è ancora in chiaro in memoria, e generarla altrove
  // richiederebbe riscaricare e ridecifrare il file appena caricato.
  // Costo di banda risolto: senza, aprire la scheda di questo stesso
  // contenuto riscaricherebbe il file intero solo per mostrarne
  // un'anteprima --- su una scansione da 15 MB, ogni apertura (v.
  // lib/thumbnail.ts per i numeri).
  const thumbnailBlob = canHaveThumbnail(mimeType)
    ? await createThumbnail(plaintext, mimeType)
    : null;

  onPhase?.("saving", null);

  const [
    { wrappedDocumentKey, payload },
    encryptedFilename,
    encryptedNotes,
    encryptedTags,
    encryptedIssuer,
    encryptedExtractedText,
    encryptedThumbnail,
  ] = await Promise.all([
    encryptDocument(masterKey, plaintext),
    // Il nome scelto dall'utente se c'è, altrimenti quello del file:
    // "scan_0012.pdf" diventa "Polizza RC auto --- Generali" (FASE 19b).
    encryptBytes(masterKey, utf8ToBytes(title?.trim() || file.name)),
    encryptOptionalText(masterKey, metadata.notes),
    encryptTags(masterKey, metadata.tags),
    encryptOptionalText(masterKey, metadata.issuer),
    encryptOptionalText(masterKey, extractedText ?? ""),
    encryptThumbnail(masterKey, thumbnailBlob),
  ]);

  const documentId = crypto.randomUUID();
  const storagePath = documentStoragePath(ownerId, documentId);

  await uploadEncryptedPayload(supabase, storagePath, serializeEnvelope(payload));

  // Best-effort e non nel Promise.all qui sopra: una miniatura che non
  // si riesce a salvare non deve impedire di salvare il documento ---
  // è un di più, non il contenuto. `hasThumbnail` riflette se è
  // *davvero* arrivata a destinazione, non solo se si è tentato.
  let hasThumbnail = false;
  if (encryptedThumbnail) {
    try {
      await uploadEncryptedThumbnail(supabase, documentThumbnailPath(storagePath), encryptedThumbnail);
      hasThumbnail = true;
    } catch (error) {
      console.warn("[thumbnail] impossibile salvare la miniatura:", error);
    }
  }

  const { error } = await supabase.from("documents").insert({
    id: documentId,
    owner_id: ownerId,
    encrypted_filename: serializeEnvelope(encryptedFilename),
    wrapped_document_key: serializeEnvelope(wrappedDocumentKey),
    storage_path: storagePath,
    mime_type: mimeType,
    size: file.size,
    category_id: metadata.categoryId,
    related_asset_id: metadata.relatedAssetId,
    expires_at: metadata.expiresAt,
    encrypted_notes: encryptedNotes,
    encrypted_tags: encryptedTags,
    encrypted_issuer: encryptedIssuer,
    encrypted_extracted_text: encryptedExtractedText,
    // Marcato solo se un motore ha davvero provato a leggere: per un
    // tipo non ancora supportato --- o per un salvataggio arrivato
    // mentre la lettura era ancora in corso --- resta null, così il
    // recupero saprà che quel contenuto è ancora tutto da guardare.
    extracted_at: attempted ? new Date().toISOString() : null,
    has_thumbnail: hasThumbnail,
  });

  if (error) {
    // Best-effort cleanup so a failed insert doesn't leave an orphaned blob.
    await removeEncryptedPayload(supabase, storagePath).catch(() => {});
    if (hasThumbnail) {
      await removeEncryptedPayload(supabase, documentThumbnailPath(storagePath)).catch(() => {});
    }
    throw new Error(`Impossibile salvare il documento: ${error.message}`);
  }

  await logAuditEvent(supabase, ownerId, "document_created");
  await replaceDocumentDossierLinks(supabase, ownerId, documentId, metadata.dossierIds);
}

/**
 * Creates a text note: same table, same encryption as any other
 * archive item --- the note's body is encrypted as if it were a file's
 * bytes, its title as if it were a filename. Distinguished from a
 * regular uploaded file only by mime_type (NOTE_MIME_TYPE), which is
 * what lets the UI show it as an editable note instead of a download
 * (v. lib/content-kind.ts).
 */
export async function createTextNote(
  supabase: SupabaseClient<Database>,
  masterKey: CryptoKey,
  ownerId: string,
  note: TextNoteInput,
  metadata: DocumentMetadataInput,
): Promise<void> {
  const plaintext = utf8ToBytes(note.body);
  const [{ wrappedDocumentKey, payload }, encryptedFilename, encryptedNotes, encryptedTags, encryptedIssuer] =
    await Promise.all([
      encryptDocument(masterKey, plaintext),
      encryptBytes(masterKey, utf8ToBytes(note.title)),
      encryptOptionalText(masterKey, metadata.notes),
      encryptTags(masterKey, metadata.tags),
      encryptOptionalText(masterKey, metadata.issuer),
    ]);

  const documentId = crypto.randomUUID();
  const storagePath = documentStoragePath(ownerId, documentId);

  await uploadEncryptedPayload(supabase, storagePath, serializeEnvelope(payload));

  const { error } = await supabase.from("documents").insert({
    id: documentId,
    owner_id: ownerId,
    encrypted_filename: serializeEnvelope(encryptedFilename),
    wrapped_document_key: serializeEnvelope(wrappedDocumentKey),
    storage_path: storagePath,
    mime_type: NOTE_MIME_TYPE,
    size: plaintext.byteLength,
    category_id: metadata.categoryId,
    related_asset_id: metadata.relatedAssetId,
    expires_at: metadata.expiresAt,
    encrypted_notes: encryptedNotes,
    encrypted_tags: encryptedTags,
    encrypted_issuer: encryptedIssuer,
  });

  if (error) {
    await removeEncryptedPayload(supabase, storagePath).catch(() => {});
    throw new Error(`Impossibile salvare la nota: ${error.message}`);
  }

  await logAuditEvent(supabase, ownerId, "document_created");
  await replaceDocumentDossierLinks(supabase, ownerId, documentId, metadata.dossierIds);
}

/**
 * Updates a text note's own title/body --- the one kind of archive item
 * whose content is meant to be edited in place, rather than replaced by
 * re-uploading. Re-encrypts with a fresh Document Key (same as any
 * fresh encryptDocument call) and uploads to a *new* storage path
 * rather than overwriting the old one --- same reason avatars get a
 * fresh path on every re-upload (v. lib/storage/avatars-bucket.ts):
 * Storage reads can otherwise be served briefly stale, which here would
 * mean ciphertext encrypted under the *old* key paired with the row's
 * *new* wrapped key --- decryption fails outright rather than just
 * showing old content, so it isn't a corner case worth risking.
 */
export async function updateTextNoteContent(
  supabase: SupabaseClient<Database>,
  masterKey: CryptoKey,
  ownerId: string,
  doc: Pick<DocumentListItem, "id" | "storagePath">,
  note: TextNoteInput,
): Promise<void> {
  const plaintext = utf8ToBytes(note.body);
  const [{ wrappedDocumentKey, payload }, encryptedFilename] = await Promise.all([
    encryptDocument(masterKey, plaintext),
    encryptBytes(masterKey, utf8ToBytes(note.title)),
  ]);

  const newStoragePath = `${ownerId}/${doc.id}-${Date.now()}.json`;
  await uploadEncryptedPayload(supabase, newStoragePath, serializeEnvelope(payload));

  const { error } = await supabase
    .from("documents")
    .update({
      encrypted_filename: serializeEnvelope(encryptedFilename),
      wrapped_document_key: serializeEnvelope(wrappedDocumentKey),
      storage_path: newStoragePath,
      size: plaintext.byteLength,
    })
    .eq("id", doc.id);

  if (error) {
    await removeEncryptedPayload(supabase, newStoragePath).catch(() => {});
    throw new Error(`Impossibile aggiornare la nota: ${error.message}`);
  }

  await removeEncryptedPayload(supabase, doc.storagePath).catch(() => {});
}

/**
 * Updates a document's metadata (category, expiry, notes, tags, issuer)
 * --- never the file content or its name. Re-encrypts notes/tags/issuer
 * with the Master Key, same as at upload time.
 */
export async function updateDocumentMetadata(
  supabase: SupabaseClient<Database>,
  masterKey: CryptoKey,
  documentId: string,
  metadata: DocumentMetadataInput,
): Promise<void> {
  const [encryptedNotes, encryptedTags, encryptedIssuer] = await Promise.all([
    encryptOptionalText(masterKey, metadata.notes),
    encryptTags(masterKey, metadata.tags),
    encryptOptionalText(masterKey, metadata.issuer),
  ]);

  const { error } = await supabase
    .from("documents")
    .update({
      category_id: metadata.categoryId,
      related_asset_id: metadata.relatedAssetId,
      expires_at: metadata.expiresAt,
      encrypted_notes: encryptedNotes,
      encrypted_tags: encryptedTags,
      encrypted_issuer: encryptedIssuer,
    })
    .eq("id", documentId);

  if (error) {
    throw new Error(`Impossibile aggiornare il documento: ${error.message}`);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Devi essere autenticato.");
  await replaceDocumentDossierLinks(supabase, user.id, documentId, metadata.dossierIds);
}

/**
 * Updates an audio/video item's transcript --- a separate action from
 * updateDocumentMetadata (it's shown only for that content kind, not
 * part of the generic metadata form). Written by hand today (v.
 * domain/transcription): swapping in a real engine later only changes
 * what fills the textarea, not this function.
 */
export async function updateDocumentTranscript(
  supabase: SupabaseClient<Database>,
  masterKey: CryptoKey,
  documentId: string,
  transcript: string,
): Promise<void> {
  const encryptedTranscript = await encryptOptionalText(masterKey, transcript);

  const { error } = await supabase
    .from("documents")
    .update({ encrypted_transcript: encryptedTranscript })
    .eq("id", documentId);

  if (error) {
    throw new Error(`Impossibile salvare la trascrizione: ${error.message}`);
  }
}

/**
 * La miniatura di un contenuto, se ne ha una --- v. lib/thumbnail.ts per
 * il perché esiste. `null` quando non c'è: tipo senza miniatura, un
 * contenuto caricato prima che questa possibilità esistesse, o una
 * generazione/upload che a suo tempo non è riuscita. Chi chiama deve
 * ricadere sul file intero in tutti questi casi, non fallire.
 */
export async function downloadThumbnail(
  supabase: SupabaseClient<Database>,
  masterKey: CryptoKey,
  doc: Pick<DocumentListItem, "storagePath" | "hasThumbnail">,
): Promise<Blob | null> {
  if (!doc.hasThumbnail) return null;

  const serialized = await downloadOptionalEncryptedPayload(
    supabase,
    documentThumbnailPath(doc.storagePath),
  );
  if (!serialized) return null;

  try {
    const bytes = await decryptBytes(masterKey, parseEnvelope(serialized));
    return new Blob([bytes], { type: "image/jpeg" });
  } catch (error) {
    console.warn("[thumbnail] impossibile decifrare la miniatura:", error);
    return null;
  }
}

/** Downloads and decrypts a document's content client-side. */
export async function downloadDocument(
  supabase: SupabaseClient<Database>,
  masterKey: CryptoKey,
  doc: DocumentListItem,
): Promise<{ filename: string; mimeType: string; bytes: Uint8Array }> {
  const serializedPayload = await downloadEncryptedPayload(supabase, doc.storagePath);

  const encrypted: EncryptedDocument = {
    wrappedDocumentKey: parseEnvelope(doc.wrappedDocumentKey),
    payload: parseEnvelope(serializedPayload),
  };
  const bytes = await decryptDocument(masterKey, encrypted);

  return { filename: doc.filename, mimeType: doc.mimeType, bytes };
}

/**
 * FASE 17b --- i contenuti già in archivio da prima che l'estrazione
 * esistesse: `extractedAt` null e un tipo che oggi sappiamo leggere.
 * Sono gli unici per cui la ricerca dentro il file non funziona ancora.
 */
export function documentsAwaitingExtraction(documents: DocumentListItem[]): DocumentListItem[] {
  return documents.filter((doc) => doc.extractedAt === null && canExtractText(doc.mimeType));
}

/**
 * Legge un contenuto già archiviato e ne salva il testo --- l'unico
 * caso in cui serve scaricare e decifrare il file, non avendolo più in
 * chiaro come al momento del caricamento.
 *
 * Marca `extracted_at` **anche quando non trova nulla**: è ciò che
 * distingue "già guardato, non aveva testo" (una scansione, in attesa
 * dell'OCR) da "mai guardato", evitando di riprovare all'infinito sugli
 * stessi file.
 */
export async function extractTextForExistingDocument(
  supabase: SupabaseClient<Database>,
  masterKey: CryptoKey,
  doc: DocumentListItem,
  onProgress?: (fraction: number) => void,
): Promise<{ foundText: boolean }> {
  const { bytes } = await downloadDocument(supabase, masterKey, doc);
  const text = await extractText(bytes, doc.mimeType, onProgress);

  const update: { encrypted_extracted_text: string | null; extracted_at: string; has_thumbnail?: boolean } = {
    encrypted_extracted_text: await encryptOptionalText(masterKey, text ?? ""),
    extracted_at: new Date().toISOString(),
  };

  // Backfill della miniatura per i contenuti che ne sono ancora senza:
  // i byte in chiaro qui sopra ci sono già per leggere il testo, quindi
  // generarla costa quasi zero. Nessun banner dedicato --- si aggancia
  // agli stessi due percorsi che già esistono per il testo ("Leggili
  // ora" sui documenti mai letti, "Rileggi" su qualunque altro): un
  // contenuto letto prima di questa fase e mai riletto resta senza
  // miniatura, come già succede oggi per l'impaginazione del testo (v.
  // FASE 17e) --- stessa scelta, deliberatamente nessuna migrazione
  // forzata su tutto l'archivio.
  if (!doc.hasThumbnail && canHaveThumbnail(doc.mimeType)) {
    const thumbnail = await createThumbnail(bytes, doc.mimeType);
    if (thumbnail) {
      try {
        const encryptedThumbnail = await encryptThumbnail(masterKey, thumbnail);
        await uploadEncryptedThumbnail(
          supabase,
          documentThumbnailPath(doc.storagePath),
          encryptedThumbnail!,
        );
        update.has_thumbnail = true;
      } catch (error) {
        console.warn("[thumbnail] impossibile salvare la miniatura:", error);
      }
    }
  }

  const { error } = await supabase.from("documents").update(update).eq("id", doc.id);

  if (error) {
    throw new Error(`Impossibile salvare il testo estratto: ${error.message}`);
  }

  return { foundText: Boolean(text) };
}

/**
 * Elimina un documento per sempre --- rimuove il payload cifrato (e la
 * miniatura) da Storage e la riga dal database, senza possibilità di
 * ripristino. Da qui in avanti è usata solo per la fine del percorso:
 * il cron di purga (v. app/api/cron/trash-purge) e "Elimina ora" da
 * dentro il Cestino --- mai più come reazione diretta a "Elimina" in
 * Archivio, che ora sposta nel cestino invece (v. moveDocumentsToTrash
 * sotto).
 */
export async function deleteDocument(
  supabase: SupabaseClient<Database>,
  ownerId: string,
  doc: Pick<DocumentListItem, "id" | "storagePath" | "hasThumbnail">,
): Promise<void> {
  await removeEncryptedPayload(supabase, doc.storagePath);
  if (doc.hasThumbnail) {
    await removeEncryptedPayload(supabase, documentThumbnailPath(doc.storagePath)).catch(() => {});
  }

  const { error } = await supabase.from("documents").delete().eq("id", doc.id);
  if (error) {
    throw new Error(`Impossibile eliminare il documento: ${error.message}`);
  }

  await logAuditEvent(supabase, ownerId, "document_purged");
}

/**
 * Sposta uno o più documenti nel Cestino --- una sola UPDATE per tutti
 * gli id insieme, non un giro per documento: nessun file cifrato viene
 * toccato, resta in Storage fino alla purga vera (v. deleteDocument) o
 * al ripristino (v. restoreDocuments). `purgeAt` è calcolato UNA VOLTA
 * qui con il periodo di conservazione passato da chi chiama --- v.
 * commento sulla colonna nella migrazione 20260923000000 per il
 * perché non si ricalcola più avanti.
 */
export async function moveDocumentsToTrash(
  supabase: SupabaseClient<Database>,
  ownerId: string,
  documentIds: string[],
  retentionDays: number,
): Promise<void> {
  if (documentIds.length === 0) return;

  const deletedAt = new Date();
  const purgeAt = computePurgeAt(deletedAt, retentionDays);

  const { error } = await supabase
    .from("documents")
    .update({ deleted_at: deletedAt.toISOString(), purge_at: purgeAt.toISOString() })
    .in("id", documentIds);

  if (error) {
    throw new Error(`Impossibile spostare nel cestino: ${error.message}`);
  }

  await logAuditEvent(supabase, ownerId, "document_trashed");
}

/** Ripristina uno o più documenti dal Cestino --- torna come prima, nessun altro campo viene toccato. */
export async function restoreDocuments(
  supabase: SupabaseClient<Database>,
  ownerId: string,
  documentIds: string[],
): Promise<void> {
  if (documentIds.length === 0) return;

  const { error } = await supabase
    .from("documents")
    .update({ deleted_at: null, purge_at: null })
    .in("id", documentIds);

  if (error) {
    throw new Error(`Impossibile ripristinare: ${error.message}`);
  }

  await logAuditEvent(supabase, ownerId, "document_restored");
}
