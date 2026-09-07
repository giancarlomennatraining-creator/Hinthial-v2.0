import { headers } from "next/headers";

export interface RequestContext {
  /** Il primo indirizzo nella catena X-Forwarded-For (il client originale), o null se assente. */
  ip: string | null;
  userAgent: string | null;
}

/**
 * Legge IP e user agent della richiesta corrente --- solo dentro Server
 * Actions/Route Handlers (v. next/headers). Usato per arricchire il
 * registro Attività (v. lib/audit/log-event.ts) con "da dove" è avvenuto
 * un login, non per alcuna decisione di sicurezza qui: dietro un proxy
 * (Vercel compreso) X-Forwarded-For è impostato dall'infrastruttura, non
 * dal client, ma resta comunque un dato dichiarato dalla rete, non
 * verificato crittograficamente --- sufficiente per un log tecnico, non
 * per un controllo di accesso.
 */
export async function getRequestContext(): Promise<RequestContext> {
  const store = await headers();

  const forwardedFor = store.get("x-forwarded-for");
  const ip = forwardedFor ? forwardedFor.split(",")[0].trim() : store.get("x-real-ip");

  return { ip: ip || null, userAgent: store.get("user-agent") };
}
