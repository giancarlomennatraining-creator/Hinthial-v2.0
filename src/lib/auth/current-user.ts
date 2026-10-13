import { cache } from "react";
import { createClient } from "@/lib/db/supabase/server";
import { avatarPublicUrl } from "@/lib/storage/avatars-bucket";

export interface CurrentUser {
  id: string;
  email: string | null;
  firstName: string;
  lastName: string;
  /** "{firstName} {lastName}" (trimmed) --- convenience for UI text (greeting, menu). */
  displayName: string;
  /** Path in the "avatars" Storage bucket, or null if none set --- needed to remove the old file on re-upload. */
  avatarPath: string | null;
  /** Public URL for `avatarPath`, or null if none set. */
  avatarUrl: string | null;
  /** ISO (yyyy-mm-dd), o null se non impostata --- dato anagrafico facoltativo, in chiaro. */
  birthDate: string | null;
  /** Se il gadget "Onboarding" nella barra è nascosto (v. OnboardingWidgetVisibilityProvider) --- letto qui per evitare un lampo del gadget al primo render. */
  onboardingWidgetHidden: boolean;
  /** Se il popup "Crea la tua master key" (una tantum, v. MasterKeyIntroModal) è già stato chiuso. */
  masterKeyIntroSeen: boolean;
  /** "Cancello" generale per l'IA reale (v. HINTHIAL_MVP.md, "Explicit AI processing") --- deve essere true perché un qualunque consenso specifico abbia effetto. Come navOrientation, letto qui per evitare un lampo dello stato sbagliato al primo render. */
  aiMasterEnabled: boolean;
  /** Consenso specifico alla Chat reale --- ha effetto solo se aiMasterEnabled è true. */
  aiChatConsent: boolean;
  /** Consenso specifico all'estrazione avanzata dei contenuti (FASE 22) --- il consenso per singola categoria (Salute inclusa) vive su categories.ai_extraction_enabled, non qui. */
  aiExtractionConsent: boolean;
}

/**
 * Reads the current authenticated user + profile (server-side only), or null if signed out. Wrapped in `cache()`
 * so multiple calls per request only hit Supabase once. Uses `getSession()` (no network call) instead of
 * `getUser()` because proxy.ts already called `getUser()` for this exact request, refreshing the cookies this call
 * then reads — re-verifying again would pay for the same guarantee twice. Anywhere NOT covered by that (a Server
 * Action, an API route) should keep using `getUser()`.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const supabase = await createClient();

  const {
    data: { session },
  } = await supabase.auth.getSession();
  const user = session?.user ?? null;

  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "first_name, last_name, avatar_path, birth_date, onboarding_widget_hidden, master_key_intro_seen, ai_master_enabled, ai_chat_consent, ai_extraction_consent",
    )
    .eq("id", user.id)
    .single();

  const firstName = profile?.first_name ?? user.email?.split("@")[0] ?? "Utente";
  const lastName = profile?.last_name ?? "";
  const avatarPath = profile?.avatar_path ?? null;

  return {
    id: user.id,
    email: user.email ?? null,
    firstName,
    lastName,
    displayName: [firstName, lastName].filter(Boolean).join(" "),
    avatarPath,
    avatarUrl: avatarPath ? avatarPublicUrl(supabase, avatarPath) : null,
    birthDate: profile?.birth_date ?? null,
    onboardingWidgetHidden: profile?.onboarding_widget_hidden ?? false,
    masterKeyIntroSeen: profile?.master_key_intro_seen ?? false,
    aiMasterEnabled: profile?.ai_master_enabled ?? false,
    aiChatConsent: profile?.ai_chat_consent ?? false,
    aiExtractionConsent: profile?.ai_extraction_consent ?? false,
  };
});
