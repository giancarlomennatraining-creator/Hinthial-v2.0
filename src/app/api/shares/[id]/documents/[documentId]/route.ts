import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/db/supabase/admin";
import { isShareId } from "@/domain/dossiers/sharing";
import { loadActiveShare, recordShareAccess, SHARE_UNAVAILABLE_MESSAGE } from "@/lib/shares/public-share";
import { DOSSIER_SHARES_BUCKET, shareFilePath } from "@/lib/storage/dossier-shares-bucket";

/**
 * Una copia cifrata di un documento condiviso (un EncryptedEnvelope serializzato), per chi apre il link. Il server non può
 * leggerla: è cifrata con la chiave che sta solo nel link. Solo se il link è valido; il percorso si compone da id già
 * controllati, mai da testo libero.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; documentId: string }> },
) {
  const { id, documentId } = await params;
  if (!isShareId(id) || !isShareId(documentId)) {
    return NextResponse.json({ error: SHARE_UNAVAILABLE_MESSAGE }, { status: 404 });
  }

  const admin = createAdminClient();
  const share = await loadActiveShare(admin, id);
  if (!share) {
    return NextResponse.json({ error: SHARE_UNAVAILABLE_MESSAGE }, { status: 404 });
  }

  const { data, error } = await admin.storage
    .from(DOSSIER_SHARES_BUCKET)
    .download(shareFilePath(share.ownerId, share.id, documentId));
  if (error || !data) {
    return NextResponse.json({ error: SHARE_UNAVAILABLE_MESSAGE }, { status: 404 });
  }

  await recordShareAccess(admin, share, "document", documentId);
  return new Response(await data.text(), {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });
}
