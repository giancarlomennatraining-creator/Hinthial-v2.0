import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { logAuditEvent, logAuditEventForCurrentUser } from "@/lib/audit/log-event";
import { encryptAuditLabel } from "@/lib/audit/label";
import type { Category, CategoryInput } from "@/domain/categories/types";

/**
 * Lists the current user's categories (alphabetical). Unlike documents/
 * assets/reminders, names are plaintext --- no Master Key needed here.
 */
export async function listCategories(supabase: SupabaseClient<Database>): Promise<Category[]> {
  const { data, error } = await supabase
    .from("categories")
    .select("id, name, icon, ai_extraction_enabled, ai_extraction_enabled_until")
    .order("name");

  if (error) {
    throw new Error(`Impossibile caricare le categorie: ${error.message}`);
  }
  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    icon: row.icon,
    aiExtractionEnabled: row.ai_extraction_enabled,
    aiExtractionEnabledUntil: row.ai_extraction_enabled_until,
  }));
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

  await logAuditEvent(supabase, ownerId, "category_created", undefined, { type: "category", id });

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

  await logAuditEventForCurrentUser(supabase, "category_updated", undefined, { type: "category", id: categoryId });
}

/** Impostazioni > Intelligenza artificiale: consenso permanente per categoria (FASE 22). */
export async function setCategoryAIExtractionEnabled(
  supabase: SupabaseClient<Database>,
  categoryId: string,
  enabled: boolean,
): Promise<void> {
  const { error } = await supabase
    .from("categories")
    .update({ ai_extraction_enabled: enabled })
    .eq("id", categoryId);

  if (error) {
    throw new Error(`Impossibile salvare il consenso della categoria: ${error.message}`);
  }
}

/** "Abilita per 30 giorni" dalla scheda di un documento --- non tocca il consenso permanente, scade da solo. */
export async function grantCategoryAIExtractionTemporarily(
  supabase: SupabaseClient<Database>,
  categoryId: string,
  days: number,
): Promise<void> {
  const until = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
  const { error } = await supabase
    .from("categories")
    .update({ ai_extraction_enabled_until: until })
    .eq("id", categoryId);

  if (error) {
    throw new Error(`Impossibile abilitare temporaneamente la categoria: ${error.message}`);
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
    throw new Error(`Impossibile verificare i beni collegati: ${assetsResult.error.message}`);
  }

  return {
    documents: documentsResult.count ?? 0,
    assets: assetsResult.count ?? 0,
  };
}

/**
 * Deletes a category. Any document/asset that referenced it is not
 * deleted --- category_id there is ON DELETE SET NULL, so they just
 * become uncategorized. `categoryName` finisce nell'evento solo cifrato con la master key.
 */
export async function deleteCategory(
  supabase: SupabaseClient<Database>,
  masterKey: CryptoKey | null,
  ownerId: string,
  categoryId: string,
  categoryName: string,
): Promise<void> {
  const { error } = await supabase.from("categories").delete().eq("id", categoryId);

  if (error) {
    throw new Error(`Impossibile eliminare la categoria: ${error.message}`);
  }

  await logAuditEvent(supabase, ownerId, "category_deleted", undefined, {
    type: "category",
    id: categoryId,
    encryptedLabel: masterKey ? await encryptAuditLabel(masterKey, categoryName) : undefined,
  });
}

/** Stessa lista di seed_default_categories() (v. supabase/migrations, FASE 2) --- qui per ripristinarla anche a un utente già esistente (v. domain/danger-zone, "Cancella tutto"), non solo a uno nuovo. */
export const DEFAULT_CATEGORIES: CategoryInput[] = [
  { name: "Personale", icon: "👤" },
  { name: "Casa", icon: "🏠" },
  { name: "Veicoli", icon: "🚗" },
  { name: "Assicurazioni", icon: "🛡️" },
  { name: "Contratti", icon: "📄" },
  { name: "Fiscale", icon: "💰" },
  { name: "Salute", icon: "❤️" },
  { name: "Finanze", icon: "📊" },
  { name: "Account", icon: "🔑" },
  { name: "Altro", icon: "📦" },
];

export async function resetCategoriesToDefault(
  supabase: SupabaseClient<Database>,
  ownerId: string,
): Promise<void> {
  const { error } = await supabase.from("categories").insert(
    DEFAULT_CATEGORIES.map((category) => ({
      id: crypto.randomUUID(),
      owner_id: ownerId,
      name: category.name,
      icon: category.icon,
    })),
  );

  if (error) {
    throw new Error(`Impossibile ripristinare le categorie predefinite: ${error.message}`);
  }
}
