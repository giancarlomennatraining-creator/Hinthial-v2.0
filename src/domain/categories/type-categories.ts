import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import type { TypeCategoryOverrides } from "@/domain/ai/analysis/category-defaults";

/**
 * Le scelte dell'utente su quale categoria proporre per ciascun tipo di documento (v. category-defaults.ts). In chiaro,
 * come le categorie: non dicono cosa c'è nei documenti, solo che le bollette vanno in "Casa".
 */

/** tipo -> id della categoria scelta, oppure null per "nessuna categoria". Un tipo senza voce usa la corrispondenza predefinita. */
export async function listTypeCategoryOverrides(supabase: SupabaseClient<Database>): Promise<TypeCategoryOverrides> {
  const { data, error } = await supabase.from("document_type_categories").select("document_type, category_id");
  if (error) {
    throw new Error(`Impossibile caricare le categorie per tipo di documento: ${error.message}`);
  }
  const overrides: TypeCategoryOverrides = {};
  for (const row of data ?? []) overrides[row.document_type] = row.category_id;
  return overrides;
}

/** `categoryId` null = per questo tipo non proporre nessuna categoria. */
export async function setTypeCategory(
  supabase: SupabaseClient<Database>,
  ownerId: string,
  documentType: string,
  categoryId: string | null,
): Promise<void> {
  const { error } = await supabase
    .from("document_type_categories")
    .upsert(
      { owner_id: ownerId, document_type: documentType, category_id: categoryId, updated_at: new Date().toISOString() },
      { onConflict: "owner_id,document_type" },
    );
  if (error) {
    throw new Error(`Impossibile salvare la scelta: ${error.message}`);
  }
}

/** Toglie la scelta: per questo tipo torna la corrispondenza predefinita. */
export async function resetTypeCategory(supabase: SupabaseClient<Database>, documentType: string): Promise<void> {
  const { error } = await supabase.from("document_type_categories").delete().eq("document_type", documentType);
  if (error) {
    throw new Error(`Impossibile ripristinare la scelta: ${error.message}`);
  }
}
