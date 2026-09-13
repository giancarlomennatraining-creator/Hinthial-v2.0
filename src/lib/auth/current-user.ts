import { cache } from "react";
import { createClient } from "@/lib/db/supabase/server";
import { avatarPublicUrl } from "@/lib/storage/avatars-bucket";
import { parseNavOrientation, type NavOrientation } from "@/lib/nav-orientation";
import { parseBottomNavItems, type BottomNavItems } from "@/lib/bottom-nav";
import { parseMainNavItems, type MainNavItems } from "@/lib/main-nav";
import { NAV_ITEMS } from "@/components/layout/nav-items";

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
  /** Disposizione del menu di navigazione (v. lib/nav-orientation.ts) --- letta qui, non lato client, per evitare un lampo del layout sbagliato al primo render della shell autenticata. */
  navOrientation: NavOrientation;
  /** Voci di NAV_ITEMS mostrate nella barra fissa in basso su smartphone (v. lib/bottom-nav.ts) --- come navOrientation, letto qui per evitare un lampo delle icone sbagliate al primo render. */
  bottomNavItems: BottomNavItems;
  /** Voci di NAV_ITEMS mostrate nella barra di navigazione generale, e in che ordine (v. lib/main-nav.ts) --- come bottomNavItems, letto qui per evitare un lampo. */
  mainNavItems: MainNavItems;
  /** Se il gadget "Onboarding" nella barra è nascosto (v. OnboardingWidgetVisibilityProvider) --- come navOrientation, letto qui per evitare un lampo del gadget al primo render. */
  onboardingWidgetHidden: boolean;
  /** Se il popup "Crea la tua master key" (una tantum, v. MasterKeyIntroModal) è già stato chiuso. */
  masterKeyIntroSeen: boolean;
  /** "Cancello" generale per l'IA reale (v. HINTHIAL_MVP.md, "Explicit AI processing") --- deve essere true perché un qualunque consenso specifico abbia effetto. Come navOrientation, letto qui per evitare un lampo dello stato sbagliato al primo render. */
  aiMasterEnabled: boolean;
  /** Consenso specifico alla Chat reale --- ha effetto solo se aiMasterEnabled è true. */
  aiChatConsent: boolean;
}

/**
 * Reads the current authenticated user + profile (server-side only), or
 * null if signed out. Wrapped in React's `cache()` so multiple calls
 * within the same request (layout + page) only hit Supabase once.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "first_name, last_name, avatar_path, birth_date, nav_orientation, bottom_nav_items, main_nav_items, onboarding_widget_hidden, master_key_intro_seen, ai_master_enabled, ai_chat_consent",
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
    navOrientation: parseNavOrientation(profile?.nav_orientation),
    bottomNavItems: parseBottomNavItems(
      profile?.bottom_nav_items,
      NAV_ITEMS.map((item) => item.href),
    ),
    mainNavItems: parseMainNavItems(profile?.main_nav_items),
    onboardingWidgetHidden: profile?.onboarding_widget_hidden ?? false,
    masterKeyIntroSeen: profile?.master_key_intro_seen ?? false,
    aiMasterEnabled: profile?.ai_master_enabled ?? false,
    aiChatConsent: profile?.ai_chat_consent ?? false,
  };
});
