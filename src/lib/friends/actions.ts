"use server";

import { getCurrentUser } from "@/lib/auth/current-user";
import { createAdminClient } from "@/lib/db/supabase/admin";
import { sendEmail } from "@/lib/email/send-email";
import { friendInviteEmail, friendRequestEmail, guardianRoleRequestEmail } from "@/lib/email/templates";

/**
 * Invia l'email di invito a registrarsi su Hinthial --- v.
 * components/friends/CreateFriendForm.tsx e EditFriendForm.tsx,
 * checkbox "Invita ... su Hinthial". Il nome/l'email dell'amico restano
 * cifrati lato client: qui arriva solo l'indirizzo a cui inviare, mai
 * salvato né altrimenti usato. Il nome di chi invita è letto qui,
 * server-side, dalla sessione autenticata --- mai fidarsi di un valore
 * passato dal client per il contenuto di un'email.
 */
export async function inviteFriendToHinthial(friendEmail: string): Promise<void> {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("Devi essere autenticato.");
  }

  const { subject, html } = friendInviteEmail(user.displayName);
  await sendEmail({ to: friendEmail, subject, html });
}

/**
 * Invia l'email di una richiesta di amicizia --- v.
 * domain/friends/friend-requests.ts, sendFriendRequest, che scrive la
 * riga; questa è solo la notifica, best-effort come inviteFriendToHinthial
 * (una richiesta salvata ma senza email non blocca comunque nulla: resta
 * comunque visibile nella scheda Amici del destinatario).
 */
export async function sendFriendRequestEmail(recipientEmail: string): Promise<void> {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("Devi essere autenticato.");
  }

  const { subject, html } = friendRequestEmail(user.displayName);
  await sendEmail({ to: recipientEmail, subject, html });
}

/**
 * Invia l'email di una richiesta di diventare guardiano --- l'indirizzo
 * del destinatario non è mai leggibile dal client (è il suo vero account
 * Hinthial, non un dato cifrato nella rubrica di chi lo richiede): si usa
 * il client admin, l'unico che può risalire dall'id utente alla sua email
 * reale (v. lib/db/supabase/admin.ts), esattamente come già fa
 * automation.ts per le email di "Eredità digitale".
 */
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
