import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/db/supabase/middleware";
import { buildContentSecurityPolicy, createNonce } from "@/lib/security/csp";

export async function proxy(request: NextRequest) {
  // Un nonce per richiesta: Next.js lo legge dall'header CSP della richiesta e lo mette sui propri script (v. lib/security/csp.ts).
  const nonce = createNonce();
  const csp = buildContentSecurityPolicy({
    nonce,
    isDev: process.env.NODE_ENV === "development",
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    upgradeInsecureRequests: request.nextUrl.protocol === "https:",
  });

  const response = await updateSession(request, { "x-nonce": nonce, "Content-Security-Policy": csp });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: [
    /*
     * Run on every path except static assets and image optimization
     * files, so the auth session cookie stays fresh everywhere else.
     * Anche il motore OCR (/ocr) e il service worker restano fuori: file statici, senza sessione, e i worker non devono
     * ereditare il nonce di una pagina.
     */
    "/((?!_next/static|_next/image|favicon.ico|ocr/|sw\\.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
