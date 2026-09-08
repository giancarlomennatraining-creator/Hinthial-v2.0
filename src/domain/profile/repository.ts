import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import {
  avatarPublicUrl,
  avatarStoragePath,
  removeAvatarBlob,
  uploadAvatarBlob,
} from "@/lib/storage/avatars-bucket";
import { parseListViewPreferences, type ListViewPreferences } from "@/lib/list-view";
import { type NavOrientation } from "@/lib/nav-orientation";
import type { ProfileInput } from "@/domain/profile/types";

/**
 * Updates the current user's first/last name. Plaintext (like the
 * categories taxonomy) --- a person's name isn't sensitive the same way
 * document content is, and it's never encrypted client-side.
 */
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

/**
 * Uploads a new avatar (already cropped to a square client-side, see
 * AvatarUploadForm) and points the profile at it --- the previous image,
 * if any, is removed afterwards on a best-effort basis (a fresh path is
 * used each time so the old URL never goes stale mid-upload, v.
 * avatars-bucket.ts). Returns the new path (needed for a later removal)
 * and its public URL, to show immediately without a full page reload.
 */
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

/**
 * Reads the current user's saved list-view preferences (elenco/tabella
 * per sezione) --- a plaintext, non-sensitive display preference, kept
 * server-side (unlike the theme) so it follows the account across
 * devices (v. lib/list-view.ts).
 */
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

/**
 * Persists the full preferences object (read-modify-write done by the
 * caller, see ListViewPreferencesProvider) --- one row update per change,
 * same as any other profile field.
 */
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

/**
 * Persists the chosen navigation menu layout (v. lib/nav-orientation.ts)
 * --- read server-side on the next full navigation (see getCurrentUser),
 * so it's known before the first paint of the authenticated shell.
 */
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

/**
 * Persists whether the "Onboarding" nav-bar gadget is hidden (v.
 * OnboardingWidgetVisibilityProvider) --- sincronizzato sul server, come
 * nav_orientation, così "Nascondi" vale per davvero anche a un login
 * successivo (anche su un altro dispositivo), non solo su questo browser.
 */
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

/**
 * Segna come chiuso il popup "Crea la tua master key" (v.
 * MasterKeyIntroModal) --- una tantum: qualunque interazione che lo
 * chiude (tasto "Più tardi", ✕, o il tasto che porta alla creazione)
 * chiama questa funzione, così non ricompare più né in questa sessione
 * né in una futura (sincronizzato sul server, come onboarding_widget_hidden).
 */
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
