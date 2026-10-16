import { NextResponse, type NextRequest } from "next/server";
import { parseClientReport } from "@/lib/errors/sanitize";
import { recordError } from "@/lib/errors/record";

/**
 * Riceve gli errori del browser e i blocchi della CSP (v. components/errors/ErrorReporter.tsx). Aperta anche a chi non
 * ha fatto l'accesso: un errore sulla pagina iniziale o sul login conta quanto gli altri. Accetta solo corpi piccoli e
 * ben formati; la crescita della tabella la limita il database (una riga per errore e per giorno, al massimo 1000
 * errori diversi al giorno). Risponde sempre 204: chi segnala non ha niente da fare con la risposta.
 */
const MAX_BODY_CHARS = 4_000;

export async function POST(request: NextRequest) {
  const text = await request.text().catch(() => "");
  if (!text || text.length > MAX_BODY_CHARS) return new NextResponse(null, { status: 204 });

  let body: unknown = null;
  try {
    body = JSON.parse(text);
  } catch {
    return new NextResponse(null, { status: 204 });
  }

  const report = parseClientReport(body);
  if (report) await recordError(report, request.headers.get("user-agent"));
  return new NextResponse(null, { status: 204 });
}
