import { NextResponse } from "next/server";
import { authenticate } from "@/lib/http/api-guards";
import { aiDailyCallLimit, romeDay } from "@/lib/ai/daily-quota";

/**
 * Quante richieste a Silva ha usato oggi l'utente, e il tetto (v. lib/ai/daily-quota.ts). Il tetto vive nelle
 * variabili d'ambiente del server: per questo lo dice una rotta, non il browser da solo. Non consuma nulla.
 */
export async function GET() {
  const auth = await authenticate();
  if (auth instanceof NextResponse) return auth;
  const { supabase, user } = auth;

  const { data, error } = await supabase
    .from("ai_daily_usage")
    .select("calls")
    .eq("user_id", user.id)
    .eq("day", romeDay())
    .maybeSingle();

  // Senza la migrazione applicata la tabella non c'è: si risponde "0 usate" invece di un errore.
  const used = error ? 0 : (data?.calls ?? 0);
  return NextResponse.json({ used, limit: aiDailyCallLimit() });
}
