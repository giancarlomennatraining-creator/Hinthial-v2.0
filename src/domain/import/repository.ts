import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { createTrustedContact } from "@/domain/contacts/repository";
import { createAsset } from "@/domain/assets/repository";
import { createCategory } from "@/domain/categories/repository";
import { createReminder } from "@/domain/reminders/repository";
import { isRowReady } from "@/domain/import/types";
import type {
  AssetRow,
  ContactRow,
  ImportRowResult,
  ReferenceResolution,
  ReminderRow,
} from "@/domain/import/types";

/**
 * Turns a "create" reference into an id, creating it at most once per
 * distinct raw name within this import batch --- so 5 rows all saying
 * "Auto" don't create 5 duplicate assets/categories. Matched
 * case-insensitively, same as the preview step's own matching.
 */
async function resolveOrCreateReference(
  resolution: ReferenceResolution,
  cache: Map<string, string>,
  createOne: (name: string) => Promise<string>,
): Promise<string | null> {
  if (resolution.kind === "empty") return null;
  if (resolution.kind === "matched") return resolution.id;
  if (resolution.kind === "unresolved") return null; // Not reachable for a ready row (see isRowReady); defensive only.

  const key = resolution.rawName.trim().toLowerCase();
  const cached = cache.get(key);
  if (cached) return cached;

  const id = await createOne(resolution.rawName);
  cache.set(key, id);
  return id;
}

function skippedResult(rowNumber: number, message: string): ImportRowResult {
  return { rowNumber, status: "skipped", message };
}

export async function importContacts(
  supabase: SupabaseClient<Database>,
  masterKey: CryptoKey,
  ownerId: string,
  rows: ContactRow[],
): Promise<ImportRowResult[]> {
  const results: ImportRowResult[] = [];

  for (const row of rows) {
    if (!isRowReady(row)) {
      results.push(skippedResult(row.rowNumber, "Riga con errori, non importata."));
      continue;
    }
    try {
      await createTrustedContact(supabase, masterKey, ownerId, {
        name: row.name,
        email: row.email,
        role: row.role,
      });
      results.push({ rowNumber: row.rowNumber, status: "imported" });
    } catch (err) {
      results.push(skippedResult(row.rowNumber, err instanceof Error ? err.message : "Errore sconosciuto."));
    }
  }

  return results;
}

/** New categories created on the fly default to this icon --- same fallback used when creating one from the Categorie screen without picking an icon. */
const DEFAULT_NEW_CATEGORY_ICON = "📁";

export async function importAssets(
  supabase: SupabaseClient<Database>,
  masterKey: CryptoKey,
  ownerId: string,
  rows: AssetRow[],
): Promise<ImportRowResult[]> {
  const categoryCache = new Map<string, string>();
  const results: ImportRowResult[] = [];

  for (const row of rows) {
    if (!isRowReady(row)) {
      results.push(skippedResult(row.rowNumber, "Riga con errori, non importata."));
      continue;
    }
    try {
      const categoryId = await resolveOrCreateReference(row.category, categoryCache, (name) =>
        createCategory(supabase, ownerId, { name, icon: DEFAULT_NEW_CATEGORY_ICON }),
      );
      await createAsset(supabase, masterKey, ownerId, { name: row.name, categoryId });
      results.push({ rowNumber: row.rowNumber, status: "imported" });
    } catch (err) {
      results.push(skippedResult(row.rowNumber, err instanceof Error ? err.message : "Errore sconosciuto."));
    }
  }

  return results;
}

export async function importReminders(
  supabase: SupabaseClient<Database>,
  masterKey: CryptoKey,
  ownerId: string,
  rows: ReminderRow[],
): Promise<ImportRowResult[]> {
  const assetCache = new Map<string, string>();
  const results: ImportRowResult[] = [];

  for (const row of rows) {
    if (!isRowReady(row) || !row.dueAtIso) {
      results.push(skippedResult(row.rowNumber, "Riga con errori, non importata."));
      continue;
    }
    try {
      const assetId = await resolveOrCreateReference(row.asset, assetCache, (name) =>
        createAsset(supabase, masterKey, ownerId, { name, categoryId: null }),
      );
      await createReminder(supabase, masterKey, ownerId, {
        title: row.title,
        // Stessa conversione usata dal form manuale (RemindersPanel): la
        // colonna è un timestamp, non una data pura.
        dueAt: new Date(row.dueAtIso).toISOString(),
        relatedDocumentId: null,
        relatedAssetId: assetId,
      });
      results.push({ rowNumber: row.rowNumber, status: "imported" });
    } catch (err) {
      results.push(skippedResult(row.rowNumber, err instanceof Error ? err.message : "Errore sconosciuto."));
    }
  }

  return results;
}
