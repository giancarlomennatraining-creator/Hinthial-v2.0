import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/db/supabase/admin";
import { runDigitalLegacyCheck } from "@/domain/digital-legacy/automation";

/**
 * Chiamata una volta al giorno da Vercel Cron (v. vercel.json) --- unico
 * punto d'ingresso dell'automazione di "Eredità digitale" (fasi 1-3:
 * rilevamento inattività, promemoria, periodo di grazia). Protetta da
 * CRON_SECRET: Vercel aggiunge da sé l'header Authorization quando
 * quella variabile d'ambiente è configurata sul progetto --- senza,
 * questa route rifiuta ogni richiesta, cron incluso, invece di girare
 * senza protezione. Il vero lavoro vive in domain/digital-legacy/
 * automation.ts, testabile senza passare da qui.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const secret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const summary = await runDigitalLegacyCheck(createAdminClient());
    return NextResponse.json({ ok: true, ...summary });
  } catch (err) {
    console.error("[cron/digital-legacy] failed:", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Errore sconosciuto." },
      { status: 500 },
    );
  }
}
