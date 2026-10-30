/**
 * I dati delle pagine legali (v. app/(legal)/). Il titolare e il contatto vanno compilati da chi gestisce Hinthial:
 * finché contengono "[DA COMPILARE", le pagine li mostrano evidenziati, così non passano inosservati.
 *
 * `version` va cambiata a ogni modifica sostanziale di privacy o termini: è quella che si registra quando qualcuno li
 * accetta in registrazione (v. lib/auth/actions.ts, `terms_version`).
 */
export const LEGAL = {
  controllerName: "Giancarlo Menna",
  contactEmail: "giancarlo.menna.training@gmail.com",
  lastUpdated: "15 ottobre 2026",
  version: "2026-10-15",
} as const;

export function isPlaceholder(value: string): boolean {
  return value.startsWith("[DA COMPILARE");
}
