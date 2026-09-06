import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { listCategories } from "@/domain/categories/repository";
import { parseNavOrientation } from "@/lib/nav-orientation";
import type { CapsuleStatus } from "@/domain/capsules/types";
import type { AccountVisibilitySummary } from "@/domain/privacy/types";

const EMPTY_CAPSULE_STATUS_COUNTS: Record<CapsuleStatus, number> = { draft: 0, ready: 0, shared: 0 };

/**
 * Riepilogo di quello che il server può vedere in chiaro di questo
 * account --- ogni query qui sotto legge solo colonne mai cifrate
 * (conteggi, `status`/`is_friend` di trusted_contacts, `status` di
 * capsules, la tassonomia delle categorie, le preferenze di profilo):
 * nessuna richiede la master key, perché nessuna deve decifrare nulla.
 * È esattamente ciò che il server ha sempre potuto leggere, solo mai
 * mostrato esplicitamente prima --- v. Impostazioni > Privacy.
 */
export async function fetchAccountVisibilitySummary(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<AccountVisibilitySummary> {
  const [profileResult, documentsCount, assetsCount, contactsResult, capsulesResult, categories] =
    await Promise.all([
      supabase.from("profiles").select("created_at, nav_orientation").eq("id", userId).single(),
      supabase.from("documents").select("id", { count: "exact", head: true }),
      supabase.from("assets").select("id", { count: "exact", head: true }),
      supabase.from("trusted_contacts").select("status, is_friend"),
      supabase.from("capsules").select("status"),
      listCategories(supabase),
    ]);

  if (profileResult.error) {
    throw new Error(`Impossibile caricare il profilo: ${profileResult.error.message}`);
  }
  if (documentsCount.error) {
    throw new Error(`Impossibile contare i contenuti dell'archivio: ${documentsCount.error.message}`);
  }
  if (assetsCount.error) {
    throw new Error(`Impossibile contare gli asset: ${assetsCount.error.message}`);
  }
  if (contactsResult.error) {
    throw new Error(`Impossibile caricare i contatti fiduciari: ${contactsResult.error.message}`);
  }
  if (capsulesResult.error) {
    throw new Error(`Impossibile caricare le capsule: ${capsulesResult.error.message}`);
  }

  const contacts = contactsResult.data ?? [];
  const capsules = capsulesResult.data ?? [];

  const capsuleStatusCounts = { ...EMPTY_CAPSULE_STATUS_COUNTS };
  for (const capsule of capsules) {
    capsuleStatusCounts[capsule.status] += 1;
  }

  return {
    accountCreatedAt: profileResult.data.created_at,
    documentCount: documentsCount.count ?? 0,
    assetCount: assetsCount.count ?? 0,
    contactCount: contacts.length,
    activeContactCount: contacts.filter((c) => c.status === "active").length,
    friendContactCount: contacts.filter((c) => c.is_friend).length,
    capsuleCount: capsules.length,
    capsuleStatusCounts,
    categoryNames: categories.map((c) => c.name),
    navOrientation: parseNavOrientation(profileResult.data.nav_orientation),
  };
}
