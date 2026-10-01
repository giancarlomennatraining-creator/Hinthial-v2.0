import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

/** Private Storage bucket holding encrypted document payloads. The server only ever sees ciphertext: every object here is a serialized EncryptedEnvelope, produced client-side before upload. */
export const ENCRYPTED_DOCUMENTS_BUCKET = "encrypted-documents";

/** RLS on storage.objects requires the first path segment to be the owner's user id. */
export function documentStoragePath(ownerId: string, documentId: string): string {
  return `${ownerId}/${documentId}.json`;
}

/** La miniatura del contenuto, accanto al file a cui appartiene. Si deriva dal percorso del file invece di essere una colonna a sé: resta valida anche per le note che cambiano percorso ad ogni modifica. */
export function documentThumbnailPath(storagePath: string): string {
  return storagePath.replace(/\.json$/, "-thumb.json");
}

/** I segmenti per pagina del testo letto, accanto al file (stessa idea della miniatura: derivato dal percorso, nessuna colonna). Mai nell'esportazione. */
export function documentSegmentsPath(storagePath: string): string {
  return storagePath.replace(/\.json$/, "-segments.json");
}

export async function uploadEncryptedPayload(
  supabase: SupabaseClient<Database>,
  path: string,
  serializedEnvelope: string,
): Promise<void> {
  const { error } = await supabase.storage
    .from(ENCRYPTED_DOCUMENTS_BUCKET)
    .upload(path, new Blob([serializedEnvelope], { type: "application/json" }), {
      upsert: false,
    });

  if (error) {
    throw new Error(`Impossibile caricare il file cifrato: ${error.message}`);
  }
}

/**
 * Come uploadEncryptedPayload, ma con `upsert: true`, pensata per la miniatura non per il contenuto principale.
 * Il contenuto principale usa `upsert: false` di proposito: due caricamenti sullo stesso percorso non devono mai
 * sovrascriversi. La miniatura è dato derivato e idempotente (solo cifrato sotto la Master Key, mai wrappato da
 * una chiave documento), quindi riscriverla non rischia di accoppiare byte vecchi a una chiave nuova; senza
 * `upsert`, un backfill dopo un salvataggio andato a metà fallirebbe per sempre con "resource already exists".
 */
export async function uploadEncryptedThumbnail(
  supabase: SupabaseClient<Database>,
  path: string,
  serializedEnvelope: string,
): Promise<void> {
  const { error } = await supabase.storage
    .from(ENCRYPTED_DOCUMENTS_BUCKET)
    .upload(path, new Blob([serializedEnvelope], { type: "application/json" }), {
      upsert: true,
    });

  if (error) {
    throw new Error(`Impossibile salvare la miniatura: ${error.message}`);
  }
}

/** Come uploadEncryptedThumbnail (`upsert: true`: dato derivato e idempotente, una "Rileggi" lo riscrive) ma per i segmenti. */
export async function uploadEncryptedSegments(
  supabase: SupabaseClient<Database>,
  path: string,
  serializedEnvelope: string,
): Promise<void> {
  const { error } = await supabase.storage
    .from(ENCRYPTED_DOCUMENTS_BUCKET)
    .upload(path, new Blob([serializedEnvelope], { type: "application/json" }), {
      upsert: true,
    });

  if (error) {
    throw new Error(`Impossibile salvare le pagine lette: ${error.message}`);
  }
}

export async function downloadEncryptedPayload(
  supabase: SupabaseClient<Database>,
  path: string,
): Promise<string> {
  const { data, error } = await supabase.storage.from(ENCRYPTED_DOCUMENTS_BUCKET).download(path);

  if (error || !data) {
    throw new Error(`Impossibile scaricare il file cifrato: ${error?.message ?? "dati mancanti"}`);
  }

  return data.text();
}

/** Come downloadEncryptedPayload, ma restituisce null invece di lanciare se l'oggetto non c'è: un contenuto senza miniatura deve ricadere sul file intero, non rompere la pagina. */
export async function downloadOptionalEncryptedPayload(
  supabase: SupabaseClient<Database>,
  path: string,
): Promise<string | null> {
  const { data, error } = await supabase.storage.from(ENCRYPTED_DOCUMENTS_BUCKET).download(path);
  if (error || !data) return null;
  return data.text();
}

export async function removeEncryptedPayload(
  supabase: SupabaseClient<Database>,
  path: string,
): Promise<void> {
  const { error } = await supabase.storage.from(ENCRYPTED_DOCUMENTS_BUCKET).remove([path]);

  if (error) {
    throw new Error(`Impossibile eliminare il file cifrato: ${error.message}`);
  }
}

/** Same as removeEncryptedPayload, batched --- v. domain/danger-zone, "Cancella tutto". */
export async function removeEncryptedPayloads(
  supabase: SupabaseClient<Database>,
  paths: string[],
): Promise<void> {
  if (paths.length === 0) return;

  const { error } = await supabase.storage.from(ENCRYPTED_DOCUMENTS_BUCKET).remove(paths);

  if (error) {
    throw new Error(`Impossibile eliminare i file cifrati: ${error.message}`);
  }
}
