import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { DEFAULT_DIGITAL_LEGACY_SETTINGS, type DigitalLegacySettings } from "@/domain/digital-legacy/types";

const COLUMNS =
  "digital_legacy_enabled, digital_legacy_preset, digital_legacy_inactivity_days, digital_legacy_reminder_interval_days, digital_legacy_reminder_count, digital_legacy_grace_period_days, digital_legacy_guardian_quorum, digital_legacy_formal_verification_days, digital_legacy_final_wait_days";

/**
 * Legge i parametri di "Eredità digitale" (v. domain/digital-legacy/types.ts)
 * --- colonne su profiles, come nav_orientation e le altre preferenze
 * semplici. Ogni riga profiles esiste già per definizione (creata al
 * login, v. current-user.ts) e porta sempre questi valori con un
 * default a livello di colonna ("balanced"): il fallback qui sotto
 * copre solo l'improbabile caso in cui la riga non sia ancora leggibile.
 */
export async function getDigitalLegacySettings(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<DigitalLegacySettings> {
  const { data, error } = await supabase.from("profiles").select(COLUMNS).eq("id", userId).maybeSingle();

  if (error) {
    throw new Error(`Impossibile caricare le impostazioni di Eredità digitale: ${error.message}`);
  }
  if (!data) return DEFAULT_DIGITAL_LEGACY_SETTINGS;

  return {
    enabled: data.digital_legacy_enabled,
    preset: data.digital_legacy_preset,
    inactivityDays: data.digital_legacy_inactivity_days,
    reminderIntervalDays: data.digital_legacy_reminder_interval_days,
    reminderCount: data.digital_legacy_reminder_count,
    gracePeriodDays: data.digital_legacy_grace_period_days,
    guardianQuorum: data.digital_legacy_guardian_quorum,
    formalVerificationDays: data.digital_legacy_formal_verification_days,
    finalWaitDays: data.digital_legacy_final_wait_days,
  };
}

/** Persiste i parametri letti/modificati da getDigitalLegacySettings sopra --- v. Impostazioni > Eredità digitale. */
export async function updateDigitalLegacySettings(
  supabase: SupabaseClient<Database>,
  userId: string,
  settings: DigitalLegacySettings,
): Promise<void> {
  const { error } = await supabase
    .from("profiles")
    .update({
      digital_legacy_enabled: settings.enabled,
      digital_legacy_preset: settings.preset,
      digital_legacy_inactivity_days: settings.inactivityDays,
      digital_legacy_reminder_interval_days: settings.reminderIntervalDays,
      digital_legacy_reminder_count: settings.reminderCount,
      digital_legacy_grace_period_days: settings.gracePeriodDays,
      digital_legacy_guardian_quorum: settings.guardianQuorum,
      digital_legacy_formal_verification_days: settings.formalVerificationDays,
      digital_legacy_final_wait_days: settings.finalWaitDays,
    })
    .eq("id", userId);

  if (error) {
    throw new Error(`Impossibile salvare le impostazioni di Eredità digitale: ${error.message}`);
  }
}
