"use server";

import { getCurrentUser } from "@/lib/auth/current-user";
import { createAdminClient } from "@/lib/db/supabase/admin";
import { sendEmail } from "@/lib/email/send-email";
import { friendInviteEmail, friendRequestEmail, guardianRoleRequestEmail } from "@/lib/email/templates";

/** Invia l'email di invito a registrarsi. Il nome/l'email dell'amico restano cifrati lato client: qui arriva solo l'indirizzo a cui inviare. Il nome di chi invita è letto server-side dalla sessione autenticata. */
export async function inviteFriendToHinthial(friendEmail: string): Promise<void> {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("Devi essere autenticato.");
  }

  const { subject, html } = friendInviteEmail(user.displayName);
  await sendEmail({ to: friendEmail, subject, html });
}

/** Invia l'email di una richiesta di amicizia: solo la notifica, best-effort come inviteFriendToHinthial (senza email la richiesta resta comunque visibile nella scheda Amici). */
export async function sendFriendRequestEmail(recipientEmail: string): Promise<void> {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("Devi essere autenticato.");
  }

  const { subject, html } = friendRequestEmail(user.displayName);
  await sendEmail({ to: recipientEmail, subject, html });
}

/** Invia l'email di una richiesta di diventare guardiano: l'indirizzo del destinatario non è leggibile dal client, si usa il client admin per risalire dall'id utente alla sua email reale (v. lib/db/supabase/admin.ts). */
export async function sendGuardianRoleRequestEmail(guardianUserId: string): Promise<void> {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("Devi essere autenticato.");
  }

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.getUserById(guardianUserId);
  if (error || !data.user.email) {
    throw new Error("Impossibile trovare l'email del guardiano.");
  }

  const { subject, html } = guardianRoleRequestEmail(user.displayName);
  await sendEmail({ to: data.user.email, subject, html });
}
