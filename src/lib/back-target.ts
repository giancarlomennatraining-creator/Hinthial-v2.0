/**
 * Dove porta "Torna indietro" da una pagina di dettaglio (un documento, un fascicolo). Il genitore fisso ("Archivio" per un
 * documento) non basta: da un fascicolo, da Oggi o da una capsula, chi tocca "indietro" si aspetta di tornare lì. Per questo
 * ci si ricorda della pagina da cui si arriva (v. NavigationHistory) e, se è una di quelle che hanno senso, si torna a lei;
 * altrimenti (apertura diretta, ricarica, pagina d'arrivo non prevista) resta il genitore.
 *
 * Puro: nessun accesso al browser. Solo le pagine elencate in `ORIGINS` possono essere un ritorno: mai un modulo
 * (/new, /edit), mai la pagina stessa, mai qualcosa fuori da Hinthial.
 */

export interface BackTarget {
  href: string;
  /** "Torna all'archivio", "Torna al fascicolo"… (la freccia la mette il componente). */
  label: string;
}

/** Le pagine da cui si può arrivare a un dettaglio e come si chiamano nel ritorno. Il primo che combacia vince. */
const ORIGINS: { match: RegExp; label: string }[] = [
  { match: /^\/dashboard$/, label: "Torna a Oggi" },
  { match: /^\/archive$/, label: "Torna all'archivio" },
  { match: /^\/archive\/trash$/, label: "Torna al cestino" },
  { match: /^\/archive\/(?!new$|import$|confirm$)[^/]+$/, label: "Torna al documento" },
  { match: /^\/dossiers$/, label: "Torna ai fascicoli" },
  { match: /^\/dossiers\/(?!new$)[^/]+$/, label: "Torna al fascicolo" },
  { match: /^\/assets$/, label: "Torna ai beni" },
  { match: /^\/reminders$/, label: "Torna alle scadenze" },
  { match: /^\/capsules$/, label: "Torna alle capsule" },
  { match: /^\/friends$/, label: "Torna agli amici" },
  { match: /^\/legacy$/, label: "Torna a Eredità digitale" },
  { match: /^\/raccontami$/, label: "Torna a Raccontami" },
];

/** `origin`: il percorso della pagina da cui si arriva (senza ricerca né ancora); `here`: quello della pagina corrente. */
export function backTarget(origin: string | null, here: string, parent: BackTarget): BackTarget {
  if (!origin || origin === here) return parent;
  const found = ORIGINS.find((o) => o.match.test(origin));
  return found ? { href: origin, label: found.label } : parent;
}
