import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

/**
 * Private Storage bucket holding encrypted document payloads (see
 * supabase/migrations, FASE 4). The server only ever sees ciphertext:
 * every object here is a serialized EncryptedEnvelope
 * (src/lib/crypto/envelope.ts), produced client-side before upload.
 */
export const ENCRYPTED_DOCUMENTS_BUCKET = "encrypted-documents";

/** RLS on storage.objects requires the first path segment to be the owner's user id. */
export function documentStoragePath(ownerId: string, documentId: string): string {
  return `${ownerId}/${documentId}.json`;
}

/**
 * La miniatura del contenuto (v. lib/thumbnail.ts), accanto al file a
 * cui appartiene e cifrata come lui. Si deriva dal percorso del file
 * invece di essere una colonna a sé: così resta valida anche per le note
 * che cambiano percorso a ogni modifica, e non c'è niente da tenere
 * allineato.
 */
export function documentThumbnailPath(storagePath: string): string {
  return storagePath.replace(/\.json$/, "-thumb.json");
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
 * Come uploadEncryptedPayload, ma con `upsert: true` --- pensata per la
 * miniatura (v. lib/thumbnail.ts), non per il contenuto principale.
 *
 * Il contenuto principale usa `upsert: false` di proposito: due
 * caricamenti sullo stesso percorso non devono mai silenziosamente
 * sovrascriversi. La miniatura è diversa --- è dato **derivato e
 * idempotente**, non wrappato da nessuna chiave documento (solo cifrato
 * sotto la Master Key, v. domain/documents/repository.ts), quindi
 * riscriverla non rischia mai di accoppiare byte vecchi a una chiave
 * nuova. Senza `upsert`, un tentativo di backfill dopo un salvataggio
 * andato a metà (upload della miniatura riuscito, riga non aggiornata)
 * fallirebbe per sempre con "resource already exists" --- ed è esattamente
 * il caso che il ritentativo dovrebbe correggere, non incontrare di nuovo.
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

/**
 * Come downloadEncryptedPayload, ma restituisce null invece di lanciare
 * se l'oggetto non c'è o il download fallisce --- pensata per la
 * miniatura (v. lib/thumbnail.ts), che è un di più: un contenuto senza
 * miniatura, o con una che per qualche motivo non si riesce a
 * scaricare, deve ricadere sul file intero, non rompere la pagina.
 */
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
