import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { listCategories } from "@/domain/categories/repository";
import { listAssets } from "@/domain/assets/repository";
import { listDocuments } from "@/domain/documents/repository";
import { listReminders } from "@/domain/reminders/repository";
import { listFriends } from "@/domain/friends/repository";
import { listCapsules } from "@/domain/capsules/repository";
import type { AIContext } from "@/domain/ai/types";

/** Riunisce in un solo oggetto i repository già usati altrove --- nessuna decrittazione o query nuova. */
export async function buildAIContext(
  supabase: SupabaseClient<Database>,
  masterKey: CryptoKey,
): Promise<AIContext> {
  const [categories, assets, documents, reminders, friends, capsules] = await Promise.all([
    listCategories(supabase),
    listAssets(supabase, masterKey),
    listDocuments(supabase, masterKey),
    listReminders(supabase, masterKey),
    listFriends(supabase, masterKey),
    listCapsules(supabase, masterKey),
  ]);

  return { categories, assets, documents, reminders, friends, capsules };
}
