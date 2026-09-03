import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { listCategories } from "@/domain/categories/repository";
import { listAssets } from "@/domain/assets/repository";
import { listDocuments } from "@/domain/documents/repository";
import { listReminders } from "@/domain/reminders/repository";
import { listTrustedContacts } from "@/domain/contacts/repository";
import { listCapsules } from "@/domain/capsules/repository";
import type { AIContext } from "@/domain/ai/types";

/**
 * Costruisce l'AIContext richiamando semplicemente i repository già
 * usati da ogni altra pagina --- nessuna nuova decrittazione, nessuna
 * query nuova: è lo stesso identico dato già mostrato altrove nell'app,
 * solo riunito in un unico oggetto.
 */
export async function buildAIContext(
  supabase: SupabaseClient<Database>,
  masterKey: CryptoKey,
): Promise<AIContext> {
  const [categories, assets, documents, reminders, contacts, capsules] = await Promise.all([
    listCategories(supabase),
    listAssets(supabase, masterKey),
    listDocuments(supabase, masterKey),
    listReminders(supabase, masterKey),
    listTrustedContacts(supabase, masterKey),
    listCapsules(supabase, masterKey),
  ]);

  return { categories, assets, documents, reminders, contacts, capsules };
}
