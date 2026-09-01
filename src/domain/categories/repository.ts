import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import type { Category, CategoryInput } from "@/domain/categories/types";

/**
 * Lists the current user's categories (alphabetical). Unlike documents/
 * assets/reminders, names are plaintext --- no Master Key needed here.
 */
export async function listCategories(supabase: SupabaseClient<Database>): Promise<Category[]> {
  const { data, error } = await supabase
    .from("categories")
    .select("id, name, icon")
    .order("name");

  if (error) {
    throw new Error(`Impossibile caricare le categorie: ${error.message}`);
  }
  return data ?? [];
}

/** Returns the new category's id --- e.g. useful right after creation to link it to something else in the same flow (see domain/import). */
export async function createCategory(
  supabase: SupabaseClient<Database>,
  ownerId: string,
  input: CategoryInput,
): Promise<string> {
  const id = crypto.randomUUID();
  const { error } = await supabase.from("categories").insert({
    id,
    owner_id: ownerId,
    name: input.name,
    icon: input.icon,
  });

  if (error) {
    throw new Error(`Impossibile creare la categoria: ${error.message}`);
  }

  return id;
}

export async function updateCategory(
  supabase: SupabaseClient<Database>,
  categoryId: string,
  input: CategoryInput,
): Promise<void> {
  const { error } = await supabase
    .from("categories")
    .update({ name: input.name, icon: input.icon })
    .eq("id", categoryId);

  if (error) {
    throw new Error(`Impossibile aggiornare la categoria: ${error.message}`);
  }
}

export interface CategoryUsage {
  documents: number;
  assets: number;
}

/**
 * Counts how many documents/assets currently reference a category, so
 * the UI can warn before deleting it. Plaintext metadata (category_id),
 * like the count itself --- no Master Key needed.
 */
export async function countCategoryUsage(
  supabase: SupabaseClient<Database>,
  categoryId: string,
): Promise<CategoryUsage> {
  const [documentsResult, assetsResult] = await Promise.all([
    supabase
      .from("documents")
      .select("id", { count: "exact", head: true })
      .eq("category_id", categoryId),
    supabase
      .from("assets")
      .select("id", { count: "exact", head: true })
      .eq("category_id", categoryId),
  ]);

  if (documentsResult.error) {
    throw new Error(`Impossibile verificare i documenti collegati: ${documentsResult.error.message}`);
  }
  if (assetsResult.error) {
    throw new Error(`Impossibile verificare gli asset collegati: ${assetsResult.error.message}`);
  }

  return {
    documents: documentsResult.count ?? 0,
    assets: assetsResult.count ?? 0,
  };
}

/**
 * Deletes a category. Any document/asset that referenced it is not
 * deleted --- category_id there is ON DELETE SET NULL, so they just
 * become uncategorized.
 */
export async function deleteCategory(
  supabase: SupabaseClient<Database>,
  categoryId: string,
): Promise<void> {
  const { error } = await supabase.from("categories").delete().eq("id", categoryId);

  if (error) {
    throw new Error(`Impossibile eliminare la categoria: ${error.message}`);
  }
}
