import { createAdminClient } from "@/lib/db/supabase/admin";
import { fingerprintOf, type ErrorReportInput } from "@/lib/errors/sanitize";

/**
 * Solo in produzione su Vercel: gli e2e e lo sviluppo girano sullo stesso database, e i loro errori riempirebbero
 * l'email di ogni giorno. ERROR_REPORTS_FORCE=1 lo accende altrove, solo per provarlo (v. i test di integrazione).
 */
export function errorReportingEnabled(): boolean {
  return process.env.VERCEL_ENV === "production" || process.env.ERROR_REPORTS_FORCE === "1";
}

/**
 * Salva una segnalazione già ripulita (v. sanitize.ts) con il service role: solo il server scrive error_reports. Non
 * lancia mai: un errore nel registrare un errore non deve diventare un secondo errore, né rompere la risposta.
 */
export async function recordError(report: ErrorReportInput, userAgent: string | null): Promise<void> {
  try {
    if (!errorReportingEnabled()) return;
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.NEXT_PUBLIC_SUPABASE_URL) return;
    const admin = createAdminClient();
    const { error } = await admin.rpc("record_error_report", {
      p_fingerprint: await fingerprintOf(report),
      p_source: report.source,
      p_kind: report.kind,
      p_message: report.message,
      p_path: report.path,
      p_digest: report.digest,
      p_user_agent: userAgent ? userAgent.slice(0, 300) : null,
    });
    // La funzione manca finché la migrazione non è applicata: lo si dice una volta nel log, senza altro.
    if (error) console.error("[errors] segnalazione non salvata:", error.message);
  } catch (err) {
    console.error("[errors] segnalazione non salvata:", err instanceof Error ? err.message : err);
  }
}
