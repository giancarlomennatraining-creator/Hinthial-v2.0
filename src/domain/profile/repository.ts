import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import {
  avatarPublicUrl,
  avatarStoragePath,
  removeAvatarBlob,
  uploadAvatarBlob,
} from "@/lib/storage/avatars-bucket";
import { parseOpenEffect, type CapsuleOpenEffect } from "@/domain/capsules/open-effects";
import type { ProfileInput } from "@/domain/profile/types";
import { invalidateVault, VAULT } from "@/lib/vault-store";

/** Nome/cognome in chiaro, mai cifrati --- non sensibili come il contenuto di un documento. */
export async function updateProfile(
  supabase: SupabaseClient<Database>,
  userId: string,
  input: ProfileInput,
): Promise<void> {
  const { error } = await supabase
    .from("profiles")
    .update({ first_name: input.firstName, last_name: input.lastName, birth_date: input.birthDate })
    .eq("id", userId);

  if (error) {
    throw new Error(`Impossibile aggiornare il profilo: ${error.message}`);
  }
}

/** Carica un nuovo avatar (già ritagliato client-side) su un path fresco --- il vecchio viene rimosso dopo, best-effort. */
export async function updateAvatar(
  supabase: SupabaseClient<Database>,
  ownerId: string,
  blob: Blob,
  previousPath: string | null,
): Promise<{ path: string; url: string }> {
  const path = avatarStoragePath(ownerId);
  await uploadAvatarBlob(supabase, path, blob);

  const { error } = await supabase.from("profiles").update({ avatar_path: path }).eq("id", ownerId);
  if (error) {
    await removeAvatarBlob(supabase, path).catch(() => {});
    throw new Error(`Impossibile aggiornare il profilo: ${error.message}`);
  }

  if (previousPath) {
    await removeAvatarBlob(supabase, previousPath).catch(() => {});
  }

  return { path, url: avatarPublicUrl(supabase, path) };
}

export async function removeAvatar(
  supabase: SupabaseClient<Database>,
  ownerId: string,
  currentPath: string,
): Promise<void> {
  const { error } = await supabase
    .from("profiles")
    .update({ avatar_path: null })
    .eq("id", ownerId);
  if (error) {
    throw new Error(`Impossibile aggiornare il profilo: ${error.message}`);
  }

  await removeAvatarBlob(supabase, currentPath).catch(() => {});
}

/** "Nascondi" il gadget onboarding vale su ogni dispositivo, non solo questo browser (v. OnboardingWidgetVisibilityProvider). */
export async function updateOnboardingWidgetHidden(
  supabase: SupabaseClient<Database>,
  userId: string,
  hidden: boolean,
): Promise<void> {
  const { error } = await supabase
    .from("profiles")
    .update({ onboarding_widget_hidden: hidden })
    .eq("id", userId);

  if (error) {
    throw new Error(`Impossibile salvare la preferenza del gadget di onboarding: ${error.message}`);
  }
}

/** Cancello generale IA (v. HINTHIAL_MVP.md, "Explicit AI processing"): spegnerlo spegne anche ogni consenso specifico nella stessa richiesta; riaccenderlo NON li riaccende da solo. */
export async function updateAIMasterEnabled(
  supabase: SupabaseClient<Database>,
  userId: string,
  enabled: boolean,
): Promise<void> {
  const { error } = await supabase
    .from("profiles")
    .update(
      enabled
        ? { ai_master_enabled: true }
        : {
            ai_master_enabled: false,
            ai_chat_consent: false,
            ai_extraction_consent: false,
          },
    )
    .eq("id", userId);

  if (error) {
    throw new Error(`Impossibile salvare il consenso generale: ${error.message}`);
  }
}

/** Effetto solo se ai_master_enabled è true (riverificato lato server in api/ai/chat/route.ts). */
export async function updateAIChatConsent(
  supabase: SupabaseClient<Database>,
  userId: string,
  consent: boolean,
): Promise<void> {
  const { error } = await supabase
    .from("profiles")
    .update({ ai_chat_consent: consent })
    .eq("id", userId);

  if (error) {
    throw new Error(`Impossibile salvare il consenso: ${error.message}`);
  }
}

/** FASE 22: il "leggere contenuti" resta un consenso a due livelli --- questo generale, poi per categoria (v. domain/categories/repository.ts, setCategoryAIExtractionEnabled). */
export async function updateAIExtractionConsent(
  supabase: SupabaseClient<Database>,
  userId: string,
  consent: boolean,
): Promise<void> {
  const { error } = await supabase
    .from("profiles")
    .update({ ai_extraction_consent: consent })
    .eq("id", userId);

  if (error) {
    throw new Error(`Impossibile salvare il consenso: ${error.message}`);
  }
}

/** Una tantum, sincronizzato sul server: il popup "Crea la tua master key" non ricompare più dopo. */
export async function markMasterKeyIntroSeen(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<void> {
  const { error } = await supabase
    .from("profiles")
    .update({ master_key_intro_seen: true })
    .eq("id", userId);

  if (error) {
    throw new Error(`Impossibile salvare la preferenza: ${error.message}`);
  }
}

/** Letta lato client --- un breve caricamento qui non crea lampi percepibili. */
export async function getCapsuleCountdownVisible(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("profiles")
    .select("capsule_countdown_visible")
    .eq("id", userId)
    .single();

  if (error) {
    throw new Error(`Impossibile leggere la preferenza del countdown: ${error.message}`);
  }
  return data?.capsule_countdown_visible ?? true;
}

/** Persiste la preferenza letta da getCapsuleCountdownVisible sopra --- v. CapsuleCountdownSettings (Impostazioni > Aspetto). */
export async function updateCapsuleCountdownVisible(
  supabase: SupabaseClient<Database>,
  userId: string,
  visible: boolean,
): Promise<void> {
  invalidateVault(VAULT.capsuleCountdown);
  const { error } = await supabase
    .from("profiles")
    .update({ capsule_countdown_visible: visible })
    .eq("id", userId);

  if (error) {
    throw new Error(`Impossibile salvare la preferenza del countdown: ${error.message}`);
  }
}

/** Per quanti giorni un documento eliminato resta nel Cestino --- v. TrashRetentionSettings (Impostazioni > Aspetto). */
export async function getTrashRetentionDays(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<number> {
  const { data, error } = await supabase
    .from("profiles")
    .select("trash_retention_days")
    .eq("id", userId)
    .single();

  if (error) {
    throw new Error(`Impossibile leggere il periodo di conservazione: ${error.message}`);
  }
  return data?.trash_retention_days ?? 15;
}

/** Vale solo per i prossimi spostamenti nel cestino --- non retroattiva sui documenti già lì (v. moveDocumentsToTrash). */
export async function updateTrashRetentionDays(
  supabase: SupabaseClient<Database>,
  userId: string,
  days: number,
): Promise<void> {
  const { error } = await supabase
    .from("profiles")
    .update({ trash_retention_days: days })
    .eq("id", userId);

  if (error) {
    throw new Error(`Impossibile salvare il periodo di conservazione: ${error.message}`);
  }
}

/** Come si presentano le capsule per chi le crea: l'effetto di apertura proposto per default. */
export interface CapsuleAppearance {
  openEffect: CapsuleOpenEffect;
}

/**
 * La preferenza delle capsule (Impostazioni > Aspetto > Capsule). Non lancia mai: se non si riesce a leggerla (per
 * esempio la migrazione che l'aggiunge non è ancora applicata) vale il default, e la pagina Capsule funziona lo stesso.
 */
export async function getCapsuleAppearance(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<CapsuleAppearance> {
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("capsule_open_effect")
      .eq("id", userId)
      .single();
    if (error) return { openEffect: parseOpenEffect(null) };
    return { openEffect: parseOpenEffect(data?.capsule_open_effect) };
  } catch {
    return { openEffect: parseOpenEffect(null) };
  }
}

export async function updateCapsuleOpenEffect(
  supabase: SupabaseClient<Database>,
  userId: string,
  effect: CapsuleOpenEffect,
): Promise<void> {
  const { error } = await supabase.from("profiles").update({ capsule_open_effect: effect }).eq("id", userId);

  if (error) {
    throw new Error(`Impossibile salvare l'effetto di apertura: ${error.message}`);
  }
}
