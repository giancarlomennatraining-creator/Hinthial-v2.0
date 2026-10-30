import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { buildSummaryContext } from "@/domain/ai/context";
import { getDigitalLegacySettings } from "@/domain/digital-legacy/repository";
import { getEmergencyCard } from "@/domain/emergency-card/repository";
import { isEmergencyCardEmpty } from "@/domain/emergency-card/types";
import { computePlan, type PlanStep } from "@/domain/plan/steps";

/**
 * Legge ciò che serve e calcola il piano: la usa l'indicatore nel menu. "Oggi" ha già il contesto in pagina e calcola il
 * piano da sé (v. TodayHome), senza una seconda lettura. Ogni lettura in più è indipendente: se una fallisce vale "non fatto".
 */
export async function loadPlan(supabase: SupabaseClient<Database>, masterKey: CryptoKey): Promise<PlanStep[]> {
  const [context, extras] = await Promise.all([
    buildSummaryContext(supabase, masterKey),
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return { legacyEnabled: false, emergencyCardFilled: false };
      const [legacyEnabled, emergencyCardFilled] = await Promise.all([
        getDigitalLegacySettings(supabase, user.id).then((s) => s.enabled, () => false),
        getEmergencyCard(supabase, masterKey, user.id).then((card) => !isEmergencyCardEmpty(card), () => false),
      ]);
      return { legacyEnabled, emergencyCardFilled };
    }),
  ]);
  return computePlan({
    documents: context.documents,
    categories: context.categories,
    friends: context.friends,
    capsules: context.capsules,
    ...extras,
  });
}
