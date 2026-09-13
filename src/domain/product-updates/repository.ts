import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import type { ProductUpdateListItem } from "@/domain/product-updates/types";

/**
 * Legge l'intero registro "Novità" (v. types.ts) --- niente cifratura,
 * niente master key: contenuto uguale per tutti gli utenti, popolato
 * solo da migrazioni (v. supabase/migrations/20260914020000_product_updates.sql),
 * mai da un'azione dell'interfaccia. Poche decine di righe in tutto:
 * caricate qui per intero, il filtro di ricerca in "Vedi tutte" resta
 * lato client (v. ProductUpdatesWidget), come per le altre liste
 * dell'app.
 */
export async function listProductUpdates(
  supabase: SupabaseClient<Database>,
): Promise<ProductUpdateListItem[]> {
  const { data, error } = await supabase
    .from("product_updates")
    .select("id, title, description, published_on")
    .order("published_on", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Impossibile caricare le novità: ${error.message}`);
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    title: row.title,
    description: row.description,
    publishedOn: row.published_on,
  }));
}
