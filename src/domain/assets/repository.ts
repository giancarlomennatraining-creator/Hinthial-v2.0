import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import {
  encryptBytes,
  decryptBytes,
  parseEnvelope,
  serializeEnvelope,
  utf8ToBytes,
  bytesToUtf8,
} from "@/lib/crypto";
import type { AssetInput, AssetListItem } from "@/domain/assets/types";

const ASSET_COLUMNS = "id, encrypted_name, category_id, created_at";

type AssetRow = {
  id: string;
  encrypted_name: string;
  category_id: string | null;
  created_at: string;
};

async function toAssetListItem(masterKey: CryptoKey, row: AssetRow): Promise<AssetListItem> {
  const nameBytes = await decryptBytes(masterKey, parseEnvelope(row.encrypted_name));

  return {
    id: row.id,
    name: bytesToUtf8(nameBytes),
    categoryId: row.category_id,
    createdAt: row.created_at,
  };
}

/**
 * Lists the current user's assets (most recent first), decrypting the
 * name client-side with the Master Key.
 */
export async function listAssets(
  supabase: SupabaseClient<Database>,
  masterKey: CryptoKey,
): Promise<AssetListItem[]> {
  const { data, error } = await supabase
    .from("assets")
    .select(ASSET_COLUMNS)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Impossibile caricare gli asset: ${error.message}`);
  }

  return Promise.all((data ?? []).map((row) => toAssetListItem(masterKey, row)));
}

/** Returns the new asset's id --- e.g. useful right after creation to link it to something else in the same flow (see domain/import). */
export async function createAsset(
  supabase: SupabaseClient<Database>,
  masterKey: CryptoKey,
  ownerId: string,
  input: AssetInput,
): Promise<string> {
  const id = crypto.randomUUID();
  const encryptedName = await encryptBytes(masterKey, utf8ToBytes(input.name));

  const { error } = await supabase.from("assets").insert({
    id,
    owner_id: ownerId,
    encrypted_name: serializeEnvelope(encryptedName),
    category_id: input.categoryId,
  });

  if (error) {
    throw new Error(`Impossibile creare l'asset: ${error.message}`);
  }

  return id;
}

export async function updateAsset(
  supabase: SupabaseClient<Database>,
  masterKey: CryptoKey,
  assetId: string,
  input: AssetInput,
): Promise<void> {
  const encryptedName = await encryptBytes(masterKey, utf8ToBytes(input.name));

  const { error } = await supabase
    .from("assets")
    .update({
      encrypted_name: serializeEnvelope(encryptedName),
      category_id: input.categoryId,
    })
    .eq("id", assetId);

  if (error) {
    throw new Error(`Impossibile aggiornare l'asset: ${error.message}`);
  }
}

export async function deleteAsset(
  supabase: SupabaseClient<Database>,
  assetId: string,
): Promise<void> {
  const { error } = await supabase.from("assets").delete().eq("id", assetId);

  if (error) {
    throw new Error(`Impossibile eliminare l'asset: ${error.message}`);
  }
}
