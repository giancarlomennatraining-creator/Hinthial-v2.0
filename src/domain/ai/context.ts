import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { listCategories } from "@/domain/categories/repository";
import { listAssets } from "@/domain/assets/repository";
import { listDocuments, listDocumentSummaries } from "@/domain/documents/repository";
import { listReminders } from "@/domain/reminders/repository";
import { listFriends } from "@/domain/friends/repository";
import { listCapsules } from "@/domain/capsules/repository";
import type { AIContext, SummaryContext } from "@/domain/ai/types";

/**
 * Se più parti dell'app chiedono lo stesso contesto nello stesso momento (la barra laterale e la dashboard, all'apertura),
 * si fa una sola lettura e tutte ricevono il risultato. Non è una cache: finita la lettura si ricomincia, così un
 * elemento appena creato o modificato si vede alla richiesta successiva.
 */
function shareWhileLoading<T>(inFlight: WeakMap<CryptoKey, Promise<T>>, masterKey: CryptoKey, load: () => Promise<T>): Promise<T> {
  const existing = inFlight.get(masterKey);
  if (existing) return existing;
  const promise = load().finally(() => inFlight.delete(masterKey));
  inFlight.set(masterKey, promise);
  return promise;
}

const fullInFlight = new WeakMap<CryptoKey, Promise<AIContext>>();
const summaryInFlight = new WeakMap<CryptoKey, Promise<SummaryContext>>();

/** Tutto ciò che l'utente ha, anche il testo letto dei documenti: per la ricerca e le risposte, che ne hanno bisogno. */
export function buildAIContext(supabase: SupabaseClient<Database>, masterKey: CryptoKey): Promise<AIContext> {
  return shareWhileLoading(fullInFlight, masterKey, async () => {
    const [categories, assets, documents, reminders, friends, capsules] = await Promise.all([
      listCategories(supabase),
      listAssets(supabase, masterKey),
      listDocuments(supabase, masterKey),
      listReminders(supabase, masterKey),
      listFriends(supabase, masterKey),
      listCapsules(supabase, masterKey),
    ]);
    return { categories, assets, documents, reminders, friends, capsules };
  });
}

/** Come buildAIContext ma con i documenti leggeri: per dashboard e avanzamento, che mostrano solo conteggi e metadati. */
export function buildSummaryContext(supabase: SupabaseClient<Database>, masterKey: CryptoKey): Promise<SummaryContext> {
  return shareWhileLoading(summaryInFlight, masterKey, async () => {
    const [categories, assets, documents, reminders, friends, capsules] = await Promise.all([
      listCategories(supabase),
      listAssets(supabase, masterKey),
      listDocumentSummaries(supabase, masterKey),
      listReminders(supabase, masterKey),
      listFriends(supabase, masterKey),
      listCapsules(supabase, masterKey),
    ]);
    return { categories, assets, documents, reminders, friends, capsules };
  });
}
