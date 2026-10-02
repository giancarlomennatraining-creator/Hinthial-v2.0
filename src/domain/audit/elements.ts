import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import type { AuditEntityType } from "@/lib/audit/log-event";
import { listDocuments, listTrashedDocuments } from "@/domain/documents/repository";
import { listAssets } from "@/domain/assets/repository";
import { listFriends } from "@/domain/friends/repository";
import { listCapsules } from "@/domain/capsules/repository";
import { listDossiers } from "@/domain/dossiers/repository";
import { listCategories } from "@/domain/categories/repository";

export interface AuditElementOption {
  type: AuditEntityType;
  id: string;
  /** Nome decifrato nel browser: mai inviato al server. */
  label: string;
}

export function auditElementKey(type: AuditEntityType, id: string): string {
  return `${type}:${id}`;
}

/**
 * Gli item esistenti, con il nome decifrato, per scegliere "Elemento" nel filtro di Attività e per dare un nome
 * alla colonna Elemento. Il server non può cercare per nome (è cifrato): si sceglie da qui e si filtra per id.
 * Un elenco che non si carica non blocca gli altri: quegli item restano riconoscibili solo dal tipo.
 */
export async function listAuditElements(
  supabase: SupabaseClient<Database>,
  masterKey: CryptoKey,
): Promise<AuditElementOption[]> {
  const [documents, trashed, assets, friends, capsules, dossiers, categories] = await Promise.allSettled([
    listDocuments(supabase, masterKey),
    listTrashedDocuments(supabase, masterKey),
    listAssets(supabase, masterKey),
    listFriends(supabase, masterKey),
    listCapsules(supabase, masterKey),
    listDossiers(supabase, masterKey),
    listCategories(supabase),
  ]);

  const options: AuditElementOption[] = [];
  const add = <T>(
    result: PromiseSettledResult<T[]>,
    type: AuditEntityType,
    describe: (item: T) => { id: string; label: string },
  ) => {
    if (result.status !== "fulfilled") return;
    for (const item of result.value) options.push({ type, ...describe(item) });
  };

  add(documents, "document", (d) => ({ id: d.id, label: d.filename }));
  add(trashed, "document", (d) => ({ id: d.id, label: `${d.filename} (nel cestino)` }));
  add(assets, "asset", (a) => ({ id: a.id, label: a.name }));
  add(friends, "friend", (f) => ({ id: f.id, label: f.name }));
  add(capsules, "capsule", (c) => ({ id: c.id, label: c.title }));
  add(dossiers, "dossier", (d) => ({ id: d.id, label: d.title }));
  add(categories, "category", (c) => ({ id: c.id, label: `${c.icon} ${c.name}` }));

  return options;
}
