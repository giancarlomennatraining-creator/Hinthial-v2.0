import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/db/supabase/admin";
import { runTrashPurge } from "@/domain/documents/purge";
import { runSharesPurge } from "@/lib/shares/purge";

/** Stesso guscio del cron di Eredità digitale --- v. app/api/cron/digital-legacy/route.ts. */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const secret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const admin = createAdminClient();
    const summary = await runTrashPurge(admin);
    // Le copie cifrate dei link di condivisione scaduti o revocati (v. lib/shares/purge.ts): stesso passaggio giornaliero.
    const shares = await runSharesPurge(admin).catch(() => ({ purged: 0, failed: -1 }));
    return NextResponse.json({ ok: true, ...summary, shares });
  } catch (err) {
    console.error("[cron/trash-purge] failed:", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Errore sconosciuto." },
      { status: 500 },
    );
  }
}
