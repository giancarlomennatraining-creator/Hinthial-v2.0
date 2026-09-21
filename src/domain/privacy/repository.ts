import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { listCategories } from "@/domain/categories/repository";
import { parseNavOrientation } from "@/lib/nav-orientation";
import type { CapsuleStatus } from "@/domain/capsules/types";
import type { DossierStatus } from "@/domain/dossiers/types";
import type { AccountVisibilitySummary } from "@/domain/privacy/types";

const EMPTY_CAPSULE_STATUS_COUNTS: Record<CapsuleStatus, number> = { draft: 0, ready: 0, shared: 0 };
const EMPTY_DOSSIER_STATUS_COUNTS: Record<DossierStatus, number> = { open: 0, closed: 0 };

/**
 * Riepilogo di quello che il server può vedere in chiaro di questo
 * account --- ogni query qui sotto legge solo colonne mai cifrate
 * (conteggi, `status`/`is_guardian` di friends, `status` di capsules, la
 * tassonomia delle categorie, le preferenze di profilo): nessuna
 * richiede la master key, perché nessuna deve decifrare nulla. È
 * esattamente ciò che il server ha sempre potuto leggere, solo mai
 * mostrato esplicitamente prima --- v. Impostazioni > Privacy.
 */
export async function fetchAccountVisibilitySummary(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<AccountVisibilitySummary> {
  const [
    profileResult,
    documentsCount,
    assetsCount,
    friendsResult,
    capsulesResult,
    remindersResult,
    dossiersResult,
    categories,
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("created_at, nav_orientation, onboarding_widget_hidden")
      .eq("id", userId)
      .single(),
    supabase.from("documents").select("id", { count: "exact", head: true }),
    supabase.from("assets").select("id", { count: "exact", head: true }),
    supabase.from("friends").select("status, is_guardian"),
    supabase.from("capsules").select("status"),
    supabase.from("reminders").select("completed"),
    supabase.from("dossiers").select("status"),
    listCategories(supabase),
  ]);

  if (profileResult.error) {
    throw new Error(`Impossibile caricare il profilo: ${profileResult.error.message}`);
  }
  if (documentsCount.error) {
    throw new Error(`Impossibile contare i contenuti dell'archivio: ${documentsCount.error.message}`);
  }
  if (assetsCount.error) {
    throw new Error(`Impossibile contare i beni: ${assetsCount.error.message}`);
  }
  if (friendsResult.error) {
    throw new Error(`Impossibile caricare gli amici: ${friendsResult.error.message}`);
  }
  if (capsulesResult.error) {
    throw new Error(`Impossibile caricare le capsule: ${capsulesResult.error.message}`);
  }
  if (remindersResult.error) {
    throw new Error(`Impossibile caricare i promemoria: ${remindersResult.error.message}`);
  }
  if (dossiersResult.error) {
    throw new Error(`Impossibile caricare i fascicoli: ${dossiersResult.error.message}`);
  }

  const friends = friendsResult.data ?? [];
  const capsules = capsulesResult.data ?? [];
  const reminders = remindersResult.data ?? [];
  const dossiers = dossiersResult.data ?? [];

  const capsuleStatusCounts = { ...EMPTY_CAPSULE_STATUS_COUNTS };
  for (const capsule of capsules) {
    capsuleStatusCounts[capsule.status] += 1;
  }

  const dossierStatusCounts = { ...EMPTY_DOSSIER_STATUS_COUNTS };
  for (const dossier of dossiers) {
    dossierStatusCounts[dossier.status as DossierStatus] += 1;
  }

  return {
    accountCreatedAt: profileResult.data.created_at,
    documentCount: documentsCount.count ?? 0,
    assetCount: assetsCount.count ?? 0,
    friendCount: friends.length,
    activeFriendCount: friends.filter((c) => c.status === "active").length,
    guardianCount: friends.filter((c) => c.is_guardian).length,
    capsuleCount: capsules.length,
    capsuleStatusCounts,
    reminderCount: reminders.length,
    pendingReminderCount: reminders.filter((r) => !r.completed).length,
    dossierCount: dossiers.length,
    dossierStatusCounts,
    categoryNames: categories.map((c) => c.name),
    navOrientation: parseNavOrientation(profileResult.data.nav_orientation),
    onboardingWidgetHidden: profileResult.data.onboarding_widget_hidden,
  };
}
