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
import { logAuditEvent, logAuditEventForCurrentUser } from "@/lib/audit/log-event";
import type { AssetInput, AssetListItem } from "@/domain/assets/types";
import { invalidateVault, VAULT } from "@/lib/vault-store";

const ASSET_COLUMNS = "id, encrypted_name, encrypted_legacy_note, category_id, created_at";

type AssetRow = {
  id: string;
  encrypted_name: string;
  encrypted_legacy_note: string | null;
  category_id: string | null;
  created_at: string;
};

/** Una nota facoltativa: vuota diventa null (nessun inviluppo cifrato inutile), e null torna "". */
async function encryptLegacyNote(masterKey: CryptoKey, note: string): Promise<string | null> {
  const trimmed = note.trim();
  if (!trimmed) return null;
  return serializeEnvelope(await encryptBytes(masterKey, utf8ToBytes(trimmed)));
}

async function toAssetListItem(masterKey: CryptoKey, row: AssetRow): Promise<AssetListItem> {
  const nameBytes = await decryptBytes(masterKey, parseEnvelope(row.encrypted_name));
  const noteBytes = row.encrypted_legacy_note
    ? await decryptBytes(masterKey, parseEnvelope(row.encrypted_legacy_note))
    : null;

  return {
    id: row.id,
    name: bytesToUtf8(nameBytes),
    legacyNote: noteBytes ? bytesToUtf8(noteBytes) : "",
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
    throw new Error(`Impossibile caricare i beni: ${error.message}`);
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
  invalidateVault(VAULT.assets);
  const id = crypto.randomUUID();
  const encryptedName = await encryptBytes(masterKey, utf8ToBytes(input.name));

  const { error } = await supabase.from("assets").insert({
    id,
    owner_id: ownerId,
    encrypted_name: serializeEnvelope(encryptedName),
    encrypted_legacy_note: await encryptLegacyNote(masterKey, input.legacyNote ?? ""),
    category_id: input.categoryId,
  });

  if (error) {
    throw new Error(`Impossibile creare il bene: ${error.message}`);
  }

  await logAuditEvent(supabase, ownerId, "asset_created", undefined, { type: "asset", id });

  return id;
}

export async function updateAsset(
  supabase: SupabaseClient<Database>,
  masterKey: CryptoKey,
  assetId: string,
  input: AssetInput,
): Promise<void> {
  invalidateVault(VAULT.assets);
  const encryptedName = await encryptBytes(masterKey, utf8ToBytes(input.name));

  const { error } = await supabase
    .from("assets")
    .update({
      encrypted_name: serializeEnvelope(encryptedName),
      category_id: input.categoryId,
      // Assente = non si tocca: chi aggiorna solo nome e categoria non cancella la nota.
      ...(input.legacyNote === undefined
        ? {}
        : { encrypted_legacy_note: await encryptLegacyNote(masterKey, input.legacyNote) }),
    })
    .eq("id", assetId);

  if (error) {
    throw new Error(`Impossibile aggiornare il bene: ${error.message}`);
  }

  await logAuditEventForCurrentUser(supabase, "asset_updated", undefined, { type: "asset", id: assetId });
}

/** Scrive (o toglie, se vuota) la nota "cosa succede a questo bene": solo quella colonna, nome e categoria restano come sono. */
export async function setAssetLegacyNote(
  supabase: SupabaseClient<Database>,
  masterKey: CryptoKey,
  assetId: string,
  note: string,
): Promise<void> {
  invalidateVault(VAULT.assets);
  const { error } = await supabase
    .from("assets")
    .update({ encrypted_legacy_note: await encryptLegacyNote(masterKey, note) })
    .eq("id", assetId);

  if (error) {
    throw new Error(`Impossibile salvare la nota del bene: ${error.message}`);
  }

  await logAuditEventForCurrentUser(supabase, "asset_updated", undefined, { type: "asset", id: assetId });
}

export async function deleteAsset(
  supabase: SupabaseClient<Database>,
  ownerId: string,
  assetId: string,
): Promise<void> {
  invalidateVault(VAULT.assets, VAULT.documents);
  // Il nome è già cifrato nella riga: lo si copia nell'evento, per riconoscere il bene dopo l'eliminazione.
  const { data: nameRow } = await supabase.from("assets").select("encrypted_name").eq("id", assetId).maybeSingle();

  const { error } = await supabase.from("assets").delete().eq("id", assetId);

  if (error) {
    throw new Error(`Impossibile eliminare il bene: ${error.message}`);
  }

  await logAuditEvent(supabase, ownerId, "asset_deleted", undefined, {
    type: "asset",
    id: assetId,
    encryptedLabel: nameRow?.encrypted_name,
  });
}
