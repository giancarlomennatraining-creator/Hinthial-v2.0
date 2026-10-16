import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { formatSize } from "@/lib/format";

/**
 * Lo spazio per utente (v. migrazione 20261017000001_storage_quota.sql). Il vero limite è nel database, che rifiuta i
 * caricamenti oltre il tetto anche scavalcando l'app; qui si controlla prima, per dire perché con parole chiare invece
 * di un errore di permessi, e senza far partire un caricamento destinato a fallire.
 */

export interface StorageUsage {
  usedBytes: number;
  quotaBytes: number;
}

export class StorageQuotaError extends Error {
  constructor(quotaBytes: number) {
    super(storageQuotaMessage(quotaBytes));
    this.name = "StorageQuotaError";
  }
}

export function storageQuotaMessage(quotaBytes: number): string {
  return (
    `Hai finito lo spazio a disposizione (${formatSize(quotaBytes)}). ` +
    "Per fare posto svuota il Cestino o elimina i contenuti che non ti servono più."
  );
}

/** PostgREST risponde così quando la funzione non esiste: la migrazione non è ancora stata applicata. */
const FUNCTION_NOT_FOUND = "PGRST202";

/** Spazio usato e tetto dell'utente collegato; `null` se non si riesce a saperlo (migrazione assente, rete). */
export async function getMyStorageUsage(supabase: SupabaseClient<Database>): Promise<StorageUsage | null> {
  const { data, error } = await supabase.rpc("my_storage_usage");
  if (error) {
    if (error.code !== FUNCTION_NOT_FOUND) console.error("[storage/quota] lettura dello spazio non riuscita:", error.message);
    return null;
  }
  const row = Array.isArray(data) ? data[0] : null;
  if (!row) return null;
  return { usedBytes: Number(row.used_bytes), quotaBytes: Number(row.quota_bytes) };
}

/** Se `incomingBytes` in più farebbero superare il tetto. Puro, per i test e per l'indicatore. */
export function wouldExceedQuota(usage: StorageUsage, incomingBytes: number): boolean {
  return usage.usedBytes + incomingBytes > usage.quotaBytes;
}

/**
 * Prima di caricare: lancia `StorageQuotaError` se il file non ci sta. Se lo spazio non si riesce a leggere si lascia
 * passare: deciderà il database, e `quotaErrorOrNull` ne tradurrà il rifiuto.
 */
export async function assertStorageRoom(supabase: SupabaseClient<Database>, incomingBytes: number): Promise<void> {
  const usage = await getMyStorageUsage(supabase);
  if (usage && wouldExceedQuota(usage, incomingBytes)) throw new StorageQuotaError(usage.quotaBytes);
}

/**
 * Dopo un caricamento rifiutato: se il rifiuto viene dal tetto (una policy, quindi "row-level security"), l'errore
 * leggibile; altrimenti `null` e chi chiama mostra il suo.
 */
export async function quotaErrorOrNull(
  supabase: SupabaseClient<Database>,
  uploadError: { message: string },
): Promise<StorageQuotaError | null> {
  if (!/row-level security|violates/i.test(uploadError.message)) return null;
  const usage = await getMyStorageUsage(supabase);
  return usage && usage.usedBytes >= usage.quotaBytes ? new StorageQuotaError(usage.quotaBytes) : null;
}
