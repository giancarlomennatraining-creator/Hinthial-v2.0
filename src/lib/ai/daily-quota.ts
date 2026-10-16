import type { SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import type { Database } from "@/types/supabase";

/**
 * Il tetto giornaliero alle chiamate a Claude, per utente (v. migrazione 20261017000000_ai_daily_usage.sql). Ogni rotta
 * di Hinthia lo consuma dopo aver verificato consenso e richiesta, subito prima di chiamare Claude: una richiesta non
 * valida non conta. Una lettura di documento lungo sono più chiamate (una per parte, più la fusione).
 *
 * Il valore si cambia con AI_DAILY_CALL_LIMIT nelle variabili d'ambiente, senza toccare il codice.
 */
export const DEFAULT_AI_DAILY_CALL_LIMIT = 300;

export function aiDailyCallLimit(raw: string | undefined = process.env.AI_DAILY_CALL_LIMIT): number {
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : DEFAULT_AI_DAILY_CALL_LIMIT;
}

export function aiQuotaExceededMessage(limit: number): string {
  return `Hai usato tutte le ${limit} richieste a Hinthia di oggi. Riprende domani: quello che hai già salvato resta com'è.`;
}

/** PostgREST risponde così quando la funzione non esiste: la migrazione non è ancora stata applicata. */
const FUNCTION_NOT_FOUND = "PGRST202";

/**
 * Conta una chiamata. `null` se si può procedere; altrimenti la risposta da restituire così com'è (429 a tetto
 * raggiunto). Se la funzione non c'è ancora, si procede e lo si scrive nel log: il codice arriva in produzione prima che
 * la migrazione sia applicata, e Hinthia non deve spegnersi nel frattempo. Per ogni altro errore ci si ferma: senza
 * contatore non si chiama Claude.
 */
export async function consumeAiCall(supabase: SupabaseClient<Database>): Promise<NextResponse | null> {
  const limit = aiDailyCallLimit();
  const { data, error } = await supabase.rpc("consume_ai_call", { daily_limit: limit });

  if (error) {
    if (error.code === FUNCTION_NOT_FOUND) {
      console.error("[ai/daily-quota] consume_ai_call non trovata: applica la migrazione 20261017000000_ai_daily_usage.sql");
      return null;
    }
    return NextResponse.json(
      { error: "Hinthia non riesce a verificare le richieste di oggi. Riprova tra poco." },
      { status: 503 },
    );
  }

  if (data === -1) {
    return NextResponse.json({ error: aiQuotaExceededMessage(limit), quotaExceeded: true }, { status: 429 });
  }
  return null;
}

/** Il giorno di Roma (`YYYY-MM-DD`) di un istante: lo stesso con cui la funzione SQL conta le chiamate. */
export function romeDay(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Rome",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
