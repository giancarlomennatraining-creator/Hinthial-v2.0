import { cache } from "react";
import { createClient } from "@/lib/db/supabase/server";
import { avatarPublicUrl } from "@/lib/storage/avatars-bucket";
import { parseNavOrientation, type NavOrientation } from "@/lib/nav-orientation";

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
  /** Se il gadget "Onboarding" nella barra è nascosto (v. OnboardingWidgetVisibilityProvider) --- come navOrientation, letto qui per evitare un lampo del gadget al primo render. */
  onboardingWidgetHidden: boolean;
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
    .select("first_name, last_name, avatar_path, birth_date, nav_orientation, onboarding_widget_hidden")
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
    onboardingWidgetHidden: profile?.onboarding_widget_hidden ?? false,
  };
});
