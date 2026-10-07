import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/db/supabase/admin";
import { isShareId } from "@/domain/dossiers/sharing";
import { loadActiveShare, recordShareAccess, SHARE_UNAVAILABLE_MESSAGE } from "@/lib/shares/public-share";

/**
 * L'indice cifrato di un fascicolo condiviso, per chi apre il link (nessun account). Il server non lo legge: lo consegna
 * così com'è, e solo se il link è valido. La chiave per aprirlo sta nel link dopo il #, che non arriva mai qui.
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isShareId(id)) {
    return NextResponse.json({ error: SHARE_UNAVAILABLE_MESSAGE }, { status: 404 });
  }

  const admin = createAdminClient();
  const share = await loadActiveShare(admin, id);
  if (!share) {
    return NextResponse.json({ error: SHARE_UNAVAILABLE_MESSAGE }, { status: 404 });
  }

  await recordShareAccess(admin, share, "open", null);
  return NextResponse.json(
    { encryptedManifest: share.encryptedManifest, allowDownload: share.allowDownload, expiresAt: share.expiresAt },
    { headers: { "Cache-Control": "no-store" } },
  );
}
