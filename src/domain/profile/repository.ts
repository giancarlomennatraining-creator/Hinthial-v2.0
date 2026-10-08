import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import {
  avatarPublicUrl,
  avatarStoragePath,
  removeAvatarBlob,
  uploadAvatarBlob,
} from "@/lib/storage/avatars-bucket";
import { parseListViewPreferences, type ListViewPreferences } from "@/lib/list-view";
import { parseDashboardStyle, type DashboardStyle } from "@/lib/dashboard-style";
import { type UnlockStyle } from "@/lib/unlock-style";
import { type NavOrientation } from "@/lib/nav-orientation";
import { type BottomNavItems } from "@/lib/bottom-nav";
import type { ProfileInput } from "@/domain/profile/types";

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

/** Preferenza elenco/tabella per sezione --- in chiaro, salvata server-side (a differenza del tema) per seguire l'account su ogni dispositivo. */
export async function fetchListViewPreferences(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<ListViewPreferences> {
  const { data, error } = await supabase
    .from("profiles")
    .select("list_view_preferences")
    .eq("id", userId)
    .single();

  if (error) {
    throw new Error(`Impossibile caricare le preferenze di visualizzazione: ${error.message}`);
  }

  return parseListViewPreferences(data.list_view_preferences);
}

/** Read-modify-write fatto dal chiamante (v. ListViewPreferencesProvider); qui solo l'update. */
export async function updateListViewPreferences(
  supabase: SupabaseClient<Database>,
  userId: string,
  preferences: ListViewPreferences,
): Promise<void> {
  const { error } = await supabase
    .from("profiles")
    .update({ list_view_preferences: preferences })
    .eq("id", userId);

  if (error) {
    throw new Error(`Impossibile salvare la preferenza di visualizzazione: ${error.message}`);
  }
}

/** Letta server-side alla prossima navigazione (v. getCurrentUser), nota prima del primo paint della shell. */
export async function updateNavOrientation(
  supabase: SupabaseClient<Database>,
  userId: string,
  orientation: NavOrientation,
): Promise<void> {
  const { error } = await supabase
    .from("profiles")
    .update({ nav_orientation: orientation })
    .eq("id", userId);

  if (error) {
    throw new Error(`Impossibile salvare la disposizione del menu: ${error.message}`);
  }
}

/** Come nav_orientation: letta al login per evitare un lampo delle icone sbagliate nella barra fissa mobile. */
export async function updateBottomNavItems(
  supabase: SupabaseClient<Database>,
  userId: string,
  items: BottomNavItems,
): Promise<void> {
  const { error } = await supabase
    .from("profiles")
    .update({ bottom_nav_items: items })
    .eq("id", userId);

  if (error) {
    throw new Error(`Impossibile salvare la barra di navigazione in basso: ${error.message}`);
  }
}

/** Voci e ordine della barra di navigazione principale --- stesso motivo di updateBottomNavItems. */
export async function updateMainNavItems(
  supabase: SupabaseClient<Database>,
  userId: string,
  items: string[],
): Promise<void> {
  const { error } = await supabase.from("profiles").update({ main_nav_items: items }).eq("id", userId);

  if (error) {
    throw new Error(`Impossibile salvare la barra di navigazione: ${error.message}`);
  }
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
            ai_transcription_consent: false,
            ai_proactive_alerts_consent: false,
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

/** FASE 22: il "leggere contenuti" resta un consenso a due livelli --- questo generale, poi per categoria (v. domain/categories/repository.ts, setCategoryAIExtractionEnabled). Spegnerlo spegne anche proactive-alerts, che ne dipende. */
export async function updateAIExtractionConsent(
  supabase: SupabaseClient<Database>,
  userId: string,
  consent: boolean,
): Promise<void> {
  const { error } = await supabase
    .from("profiles")
    .update(
      consent
        ? { ai_extraction_consent: true }
        : { ai_extraction_consent: false, ai_proactive_alerts_consent: false },
    )
    .eq("id", userId);

  if (error) {
    throw new Error(`Impossibile salvare il consenso: ${error.message}`);
  }
}

/** Consenso specifico alla trascrizione audio/video reale (FASE 22b, non ancora costruita). */
export async function updateAITranscriptionConsent(
  supabase: SupabaseClient<Database>,
  userId: string,
  consent: boolean,
): Promise<void> {
  const { error } = await supabase
    .from("profiles")
    .update({ ai_transcription_consent: consent })
    .eq("id", userId);

  if (error) {
    throw new Error(`Impossibile salvare il consenso: ${error.message}`);
  }
}

/** FASE 24, non ancora costruita --- effetto solo se ai_extraction_consent è anche true. */
export async function updateAIProactiveAlertsConsent(
  supabase: SupabaseClient<Database>,
  userId: string,
  consent: boolean,
): Promise<void> {
  const { error } = await supabase
    .from("profiles")
    .update({ ai_proactive_alerts_consent: consent })
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

/** Letta lato client (non al login come nav_orientation) --- un breve caricamento qui non crea lampi percepibili. */
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

/** Lo stile della Dashboard --- letto lato client solo da Impostazioni (la Dashboard lo riceve già dal server, v. getCurrentUser). */
export async function getDashboardStyle(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<DashboardStyle> {
  const { data, error } = await supabase.from("profiles").select("dashboard_style").eq("id", userId).single();

  if (error) {
    throw new Error(`Impossibile leggere lo stile della dashboard: ${error.message}`);
  }
  return parseDashboardStyle(data?.dashboard_style);
}

export async function updateDashboardStyle(
  supabase: SupabaseClient<Database>,
  userId: string,
  style: DashboardStyle,
): Promise<void> {
  const { error } = await supabase.from("profiles").update({ dashboard_style: style }).eq("id", userId);

  if (error) {
    throw new Error(`Impossibile salvare lo stile della dashboard: ${error.message}`);
  }
}

/** Come si presenta la finestra di sblocco --- letta dal server con il profilo (v. getCurrentUser), qui solo il salvataggio. */
export async function updateUnlockStyle(
  supabase: SupabaseClient<Database>,
  userId: string,
  style: UnlockStyle,
): Promise<void> {
  const { error } = await supabase.from("profiles").update({ unlock_style: style }).eq("id", userId);

  if (error) {
    throw new Error(`Impossibile salvare lo stile dello sblocco: ${error.message}`);
  }
}
