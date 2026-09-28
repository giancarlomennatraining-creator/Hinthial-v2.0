"use server";

import { createClient } from "@/lib/db/supabase/server";
import { createAdminClient } from "@/lib/db/supabase/admin";
import { wipeOwnerStorage } from "@/lib/storage/wipe-owner-storage";
import { sendEmail } from "@/lib/email/send-email";
import { accountDeletedEmail, accountResetEmail } from "@/lib/email/templates";

/**
 * Cancellazione definitiva dell'account: irreversibile, distinta da "Reimposta l'account" (qui sparisce anche
 * l'account stesso). Ogni riga collegata ha già ON DELETE CASCADE da auth.users: cancellare l'utente Auth le
 * elimina già tutte da sé, solo Storage va ripulito a mano. Richiede la service role key (bypassa le RLS), per
 * questo è una Server Action. Il chiamante (DeleteAccountCard) verifica la master password client-side prima di
 * chiamare questa azione: qui non viene richiesta di nuovo. Non chiama `redirect()`: il `try/catch` lato client
 * chiamante lo tratterebbe come un errore (v. i docs Next.js su redirect()); il chiamante naviga da sé dopo il successo.
 */
export async function deleteAccount(): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    throw new Error("Devi essere autenticato.");
  }

  const admin = createAdminClient();

  await wipeOwnerStorage(admin, user.id);

  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) {
    throw new Error(`Impossibile cancellare l'account: ${error.message}`);
  }

  if (user.email) {
    const { subject, html } = accountDeletedEmail();
    await sendEmail({ to: user.email, subject, html }).catch(() => {
      // La cancellazione è già avvenuta ed è irreversibile: un'email non riuscita non deve bloccare nulla.
    });
  }

  await supabase.auth.signOut().catch(() => {
    // L'utente Auth non esiste già più: best-effort solo per ripulire i cookie di sessione lato client.
  });
}

/** Email di conferma dopo "Reimposta l'account", separata dall'operazione stessa (client-side) solo perché l'invio richiede RESEND_API_KEY, che non deve mai lasciare il server. */
export async function sendAccountResetConfirmationEmail(): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return;

  const { subject, html } = accountResetEmail();
  await sendEmail({ to: user.email, subject, html });
}
