"use server";

import { getCurrentUser } from "@/lib/auth/current-user";
import { sendEmail } from "@/lib/email/send-email";
import { contactInviteEmail } from "@/lib/email/templates";

/**
 * Invia l'email di invito a registrarsi su Hinthial --- v.
 * components/contacts/CreateContactForm.tsx e EditContactForm.tsx,
 * checkbox "Invita ... su Hinthial". Il nome/l'email del contatto restano
 * cifrati lato client: qui arriva solo l'indirizzo a cui inviare, mai
 * salvato né altrimenti usato. Il nome di chi invita è letto qui,
 * server-side, dalla sessione autenticata --- mai fidarsi di un valore
 * passato dal client per il contenuto di un'email.
 */
export async function inviteContactToHinthial(contactEmail: string): Promise<void> {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("Devi essere autenticato.");
  }

  const { subject, html } = contactInviteEmail(user.displayName);
  await sendEmail({ to: contactEmail, subject, html });
}
