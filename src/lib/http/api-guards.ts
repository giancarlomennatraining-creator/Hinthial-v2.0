import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/db/supabase/server";

/**
 * I due controlli con cui iniziano le rotte API autenticate: chi è l'utente e il corpo JSON. Restituiscono un
 * `NextResponse` d'errore già pronto, da ritornare così com'è (`if (auth instanceof NextResponse) return auth;`).
 */
export async function authenticate() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Devi essere autenticato." }, { status: 401 });
  }
  return { supabase, user };
}

export async function readJsonBody(request: NextRequest): Promise<{ body: unknown } | NextResponse> {
  try {
    return { body: await request.json() };
  } catch {
    return NextResponse.json({ error: "Richiesta non valida." }, { status: 400 });
  }
}
