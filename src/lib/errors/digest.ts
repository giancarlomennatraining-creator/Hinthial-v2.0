import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { sendEmail } from "@/lib/email/send-email";
import { errorDigestEmail, type ErrorDigestRow } from "@/lib/email/templates";

/**
 * Una volta al giorno (dal cron del Cestino, v. app/api/cron/trash-purge/route.ts): gli errori non ancora segnalati
 * diventano un'email a ERROR_ALERT_EMAIL, e vengono segnati come segnalati. Nessun errore, nessuna email. Le righe più
 * vecchie di 90 giorni si cancellano: a quel punto non servono più a niente.
 */

const MAX_GROUPS_PER_EMAIL = 50;
const RETENTION_DAYS = 90;

export interface ErrorDigestSummary {
  groups: number;
  sent: boolean;
}

export async function sendErrorDigest(admin: SupabaseClient<Database>): Promise<ErrorDigestSummary> {
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  await admin.from("error_reports").delete().lt("day", cutoff);

  const { data, error } = await admin
    .from("error_reports")
    .select("id, source, kind, message, path, digest, count, first_seen, last_seen")
    .is("notified_at", null)
    .order("count", { ascending: false })
    .limit(MAX_GROUPS_PER_EMAIL);
  if (error) throw new Error(`Impossibile leggere gli errori: ${error.message}`);

  const rows = (data ?? []) as (ErrorDigestRow & { id: string })[];
  if (rows.length === 0) return { groups: 0, sent: false };

  const to = process.env.ERROR_ALERT_EMAIL;
  if (!to) {
    // Senza destinatario restano da segnalare: arriveranno appena l'indirizzo è impostato.
    console.warn(`[errors] ${rows.length} errori da segnalare ma ERROR_ALERT_EMAIL non è impostata`);
    return { groups: rows.length, sent: false };
  }

  await sendEmail({ to, ...errorDigestEmail(rows) });
  const { error: markError } = await admin
    .from("error_reports")
    .update({ notified_at: new Date().toISOString() })
    .in(
      "id",
      rows.map((r) => r.id),
    );
  if (markError) throw new Error(`Email inviata ma errori non segnati: ${markError.message}`);
  return { groups: rows.length, sent: true };
}
