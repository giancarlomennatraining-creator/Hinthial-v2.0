"use server";

import { createClient } from "@/lib/db/supabase/server";
import { createAdminClient } from "@/lib/db/supabase/admin";
import { wipeOwnerStorage } from "@/lib/storage/wipe-owner-storage";
import { sendEmail } from "@/lib/email/send-email";
import { accountDeletedEmail, accountResetEmail } from "@/lib/email/templates";

/**
 * Cancellazione definitiva dell'account (Impostazioni > Zona pericolosa,
 * "Cancella il tuo account") --- irreversibile, distinta da "Reimposta
 * l'account" (v. domain/danger-zone/repository.ts): qui sparisce anche
 * l'account stesso, non solo il suo contenuto. Ogni riga collegata
 * (profiles, documents, assets, friends, capsules, categories,
 * reminders, mfa_backup_codes, encryption_setup, audit_events) ha già
 * ON DELETE CASCADE da auth.users (v. le rispettive migrazioni):
 * cancellare l'utente Auth le elimina già tutte da sé --- solo Storage
 * (non un dato di Postgres) va ripulito a mano.
 *
 * Richiede la service role key (bypassa le RLS): `auth.admin.deleteUser`
 * non è disponibile al client anonimo/autenticato, per questo è una
 * Server Action e non una chiamata diretta dal browser. Il chiamante
 * (DeleteAccountCard) verifica la master password *prima* di chiamare
 * questa azione (client-side, l'unico posto dove può essere verificata:
 * zero-knowledge, il server non la vede mai) --- qui non viene richiesta
 * di nuovo.
 *
 * Non chiama `redirect()`: chiamata direttamente da un gestore di click
 * (non da un `<form action>`), non da un `try/catch` lato server --- il
 * `try/catch` che la avvolge è nel componente client chiamante, dove
 * intercetterebbe anche il lancio speciale di `redirect()` trattandolo
 * come un errore (v. i docs di Next.js su redirect(), che raccomandano
 * di tenerlo sempre fuori da un `try/catch`). Il chiamante naviga da sé
 * con `router.push` dopo che questa promise si è risolta con successo.
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
      // La cancellazione è già avvenuta ed è irreversibile: un'email di
      // conferma non riuscita non deve bloccare né essere segnalata a un
      // account che, a questo punto, non esiste già più.
    });
  }

  await supabase.auth.signOut().catch(() => {
    // L'utente Auth non esiste già più a questo punto --- best-effort
    // solo per ripulire i cookie di sessione lato client.
  });
}

/**
 * Email di conferma dopo "Reimposta l'account" (v.
 * ResetAccountCard/domain/danger-zone/repository.ts, wipeVault) ---
 * separata dall'operazione stessa (che resta client-side: richiede la
 * Master Key per scoprire i path da rimuovere in Storage) solo perché
 * l'invio email richiede RESEND_API_KEY, che non deve mai lasciare il
 * server.
 */
export async function sendAccountResetConfirmationEmail(): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return;

  const { subject, html } = accountResetEmail();
  await sendEmail({ to: user.email, subject, html });
}
