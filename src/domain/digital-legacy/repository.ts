import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import {
  DEFAULT_DIGITAL_LEGACY_SETTINGS,
  type DigitalLegacySettings,
  type DigitalLegacyStatus,
} from "@/domain/digital-legacy/types";

const COLUMNS =
  "digital_legacy_enabled, digital_legacy_preset, digital_legacy_inactivity_days, digital_legacy_reminder_interval_days, digital_legacy_reminder_count, digital_legacy_grace_period_days, digital_legacy_guardian_quorum, digital_legacy_formal_verification_days, digital_legacy_final_wait_days";

/** Colonne su profiles, come nav_orientation --- il fallback sotto copre solo il caso improbabile che la riga non sia leggibile. */
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

/** Niente nomi di guardiani (cifrati), solo conteggi in chiaro. `guardianResponseCounts` è null finché nessuna richiesta esiste. */
export async function getDigitalLegacyStatus(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<DigitalLegacyStatus> {
  const { data, error } = await supabase
    .from("profiles")
    .select("digital_legacy_state, digital_legacy_state_entered_at, digital_legacy_triggered_at, digital_legacy_reminders_sent")
    .eq("id", userId)
    .single();
  if (error) {
    throw new Error(`Impossibile leggere lo stato di Eredità digitale: ${error.message}`);
  }

  const { data: requests, error: requestsError } = await supabase
    .from("guardian_verification_requests")
    .select("response")
    .eq("owner_id", userId);
  if (requestsError) {
    throw new Error(`Impossibile leggere le richieste ai guardiani: ${requestsError.message}`);
  }

  const total = requests?.length ?? 0;

  return {
    state: data.digital_legacy_state,
    stateEnteredAt: data.digital_legacy_state_entered_at,
    triggeredAt: data.digital_legacy_triggered_at,
    remindersSent: data.digital_legacy_reminders_sent,
    guardianResponseCounts:
      total > 0
        ? {
            total,
            responded: requests!.filter((r) => r.response !== null).length,
            unreachable: requests!.filter((r) => r.response === "unreachable").length,
          }
        : null,
  };
}
