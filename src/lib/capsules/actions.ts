"use server";

import { getCurrentUser } from "@/lib/auth/current-user";
import { createAdminClient } from "@/lib/db/supabase/admin";
import { sendEmail } from "@/lib/email/send-email";
import { capsuleSharedEmail } from "@/lib/email/templates";

/**
 * Avvisa via email il destinatario di una capsula appena condivisa con
 * lui (v. domain/capsules/repository.ts, shareCapsule/
 * syncCapsuleSharesForLinkedFriend) --- chiamata da un componente
 * client come una qualunque Server Action.
 *
 * L'indirizzo del destinatario non arriva mai dal chiamante (che non lo
 * conosce in chiaro a questo punto: è solo un id account collegato,
 * v. friends.linked_user_id) --- viene letto qui, server-side, tramite
 * l'API admin, a partire dal solo id. Il nome di chi condivide viene
 * letto dalla sessione autenticata, mai fidandosi di un valore passato
 * dal client per il contenuto dell'email.
 *
 * Best-effort e silenzioso: un'email non inviata (Resend non
 * configurato, un problema di rete...) non deve mai far fallire la
 * condivisione della capsula in sé, di cui è solo un effetto
 * collaterale.
 */
export async function notifyCapsuleShared(recipientUserId: string): Promise<void> {
  try {
    const user = await getCurrentUser();
    if (!user) return;

    const admin = createAdminClient();
    const { data, error } = await admin.auth.admin.getUserById(recipientUserId);
    if (error || !data.user?.email) return;

    const { subject, html } = capsuleSharedEmail(user.displayName);
    await sendEmail({ to: data.user.email, subject, html });
  } catch (err) {
    console.error("[capsule-shared-email] failed to notify recipient:", err);
  }
}
