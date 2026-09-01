import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
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
    .update({ first_name: input.firstName, last_name: input.lastName })
    .eq("id", userId);

  if (error) {
    throw new Error(`Impossibile aggiornare il profilo: ${error.message}`);
  }
}
