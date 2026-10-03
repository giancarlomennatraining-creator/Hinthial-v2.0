import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * L'id dell'utente dalla sessione già nel browser, senza chiamate di rete. `auth.getUser()` interroga il server di
 * autenticazione a ogni chiamata (circa un viaggio di rete in più, in fila ai caricamenti): qui basta sapere "chi
 * sono" per filtrare e scegliere cosa leggere, e il vero controllo resta alle regole di accesso del database (RLS),
 * che usano comunque il token. Per le azioni che scrivono si continua a usare `getUser()`.
 */
export async function getLocalUserId(supabase: { auth: Pick<SupabaseClient["auth"], "getSession"> }): Promise<string | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.user.id ?? null;
}
