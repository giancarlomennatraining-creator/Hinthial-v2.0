import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import {
  bytesToUtf8,
  decryptBytes,
  encryptBytes,
  parseEnvelope,
  serializeEnvelope,
  utf8ToBytes,
} from "@/lib/crypto";
import {
  documentSegmentsPath,
  downloadOptionalEncryptedPayload,
  removeEncryptedPayload,
  uploadEncryptedSegments,
} from "@/lib/storage/documents-bucket";
import { normalizeExtractedText, type ContentSegment } from "@/domain/extraction/types";

/**
 * I segmenti per pagina del testo letto sul dispositivo, tenuti in un blob cifrato accanto al file (nessuna colonna).
 * Servono solo all'analisi di Hinthia, per citare "pagina N": non sono mai nell'esportazione e spariscono con il
 * documento (v. deleteDocument, "Cancella tutto", cancellazione account).
 */

const SEGMENTS_BLOB_VERSION = 1;

function isSegment(value: unknown): value is ContentSegment {
  if (typeof value !== "object" || value === null) return false;
  const segment = value as Record<string, unknown>;
  return (
    segment.kind === "page" &&
    typeof segment.id === "string" &&
    typeof segment.index === "number" &&
    Number.isInteger(segment.index) &&
    typeof segment.text === "string"
  );
}

/** I segmenti sono la stessa materia di `extractedText`: se non lo ricompongono esattamente, appartengono a un'altra lettura e non vanno usati. */
export function segmentsMatchText(segments: ContentSegment[], text: string): boolean {
  if (segments.length === 0) return false;
  return normalizeExtractedText(segments.map((segment) => segment.text).join("\n\n")) === text;
}

export async function encryptSegments(masterKey: CryptoKey, segments: ContentSegment[]): Promise<string> {
  const json = JSON.stringify({ v: SEGMENTS_BLOB_VERSION, segments });
  return serializeEnvelope(await encryptBytes(masterKey, utf8ToBytes(json)));
}

/** `null` se il blob è illeggibile, di un'altra versione o non corrisponde al testo: chi chiama ricade sulle sezioni. */
export async function decryptSegments(
  masterKey: CryptoKey,
  serialized: string,
  extractedText: string,
): Promise<ContentSegment[] | null> {
  try {
    const parsed: unknown = JSON.parse(bytesToUtf8(await decryptBytes(masterKey, parseEnvelope(serialized))));
    if (typeof parsed !== "object" || parsed === null) return null;
    const blob = parsed as { v?: unknown; segments?: unknown };
    if (blob.v !== SEGMENTS_BLOB_VERSION || !Array.isArray(blob.segments)) return null;
    if (!blob.segments.every(isSegment)) return null;
    const segments: ContentSegment[] = blob.segments;
    return segmentsMatchText(segments, extractedText) ? segments : null;
  } catch {
    return null;
  }
}

/** Best-effort: senza segmenti l'analisi funziona comunque, divisa in sezioni. Non lancia. */
export async function saveDocumentSegments(
  supabase: SupabaseClient<Database>,
  masterKey: CryptoKey,
  storagePath: string,
  segments: ContentSegment[],
): Promise<boolean> {
  try {
    await uploadEncryptedSegments(
      supabase,
      documentSegmentsPath(storagePath),
      await encryptSegments(masterKey, segments),
    );
    return true;
  } catch (error) {
    console.warn("[segments] impossibile salvare le pagine lette:", error);
    return false;
  }
}

/** `null` se non ci sono (documento letto prima di questa versione, o salvataggio fallito) o se non valgono più per il testo di adesso. */
export async function loadDocumentSegments(
  supabase: SupabaseClient<Database>,
  masterKey: CryptoKey,
  doc: { storagePath: string; extractedText: string },
): Promise<ContentSegment[] | null> {
  if (!doc.extractedText) return null;
  const serialized = await downloadOptionalEncryptedPayload(supabase, documentSegmentsPath(doc.storagePath));
  if (!serialized) return null;
  return decryptSegments(masterKey, serialized, doc.extractedText);
}

/** Best-effort: un oggetto già assente non è un errore, e un blob orfano non deve bloccare l'eliminazione del documento. */
export async function removeDocumentSegments(
  supabase: SupabaseClient<Database>,
  storagePath: string,
): Promise<void> {
  await removeEncryptedPayload(supabase, documentSegmentsPath(storagePath)).catch(() => {});
}
