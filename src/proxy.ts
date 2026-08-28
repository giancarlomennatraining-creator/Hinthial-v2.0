import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/db/supabase/middleware";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Run on every path except static assets and image optimization
     * files, so the auth session cookie stays fresh everywhere else.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
