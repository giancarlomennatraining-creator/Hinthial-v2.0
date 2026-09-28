import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

/**
 * Il vocabolario personale dei campi non standard --- cresce quando l'utente accetta per la prima volta una
 * chiave nuova proposta da Claude (v. domain/proposals/repository.ts, acceptProposal). Plaintext come le
 * categorie: un nome di campo è un'etichetta generica, non un contenuto personale.
 */
export interface FieldVocabularyEntry {
  fieldKey: string;
  label: string;
}

export async function listFieldVocabulary(
  supabase: SupabaseClient<Database>,
): Promise<FieldVocabularyEntry[]> {
  const { data, error } = await supabase
    .from("structured_field_vocabulary")
    .select("field_key, label")
    .order("label");

  if (error) {
    throw new Error(`Impossibile caricare il vocabolario dei campi: ${error.message}`);
  }
  return (data ?? []).map((row) => ({ fieldKey: row.field_key, label: row.label }));
}

/** Idempotente: se la chiave esiste già, non ne cambia la label --- la prima registrazione vince. */
export async function registerFieldVocabulary(
  supabase: SupabaseClient<Database>,
  ownerId: string,
  fieldKey: string,
  label: string,
): Promise<void> {
  const { error } = await supabase
    .from("structured_field_vocabulary")
    .upsert(
      { owner_id: ownerId, field_key: fieldKey, label },
      { onConflict: "owner_id,field_key", ignoreDuplicates: true },
    );

  if (error) {
    throw new Error(`Impossibile registrare il campo nel vocabolario: ${error.message}`);
  }
}
