/**
 * L'entrata animata di Hinthial ("Aurora"): compare una volta sola, la prima volta che l'app installata si apre su un
 * dispositivo, dura 3,5 secondi e lascia poi la pagina di sempre. La decisione se mostrarla si prende prima del primo
 * paint (v. INTRO_INIT_SCRIPT, uno script inline come quello del tema), così la pagina non lampeggia prima dell'animazione.
 */

export const INTRO_SEEN_KEY = "hinthial-intro-seen";

/** Quanto dura tutto, uscita compresa: lo stesso valore è scritto nei tempi di app-intro.css. */
export const INTRO_DURATION_MS = 3500;

export interface IntroInput {
  /** La query della pagina, es. "?intro=1". */
  search: string;
  /** Ha già visto l'entrata su questo dispositivo. */
  seen: boolean;
  /** Aperta come app installata (schermata Home, o guscio Android): non in una scheda del browser. */
  standalone: boolean;
  /** Chi ha chiesto meno movimento non vede animazioni né sente suoni di apertura. */
  reducedMotion: boolean;
}

/**
 * Va mostrata? Sì alla prima apertura dell'app installata; mai a chi ha chiesto meno movimento. `?intro=1` la mostra
 * comunque (per provarla da una scheda del browser), `?intro=0` la salta sempre.
 */
export function shouldPlayIntro({ search, seen, standalone, reducedMotion }: IntroInput): boolean {
  if (/[?&]intro=0(&|$)/.test(search)) return false;
  if (reducedMotion) return false;
  if (/[?&]intro=1(&|$)/.test(search)) return true;
  return standalone && !seen;
}

/**
 * La stessa regola come script autonomo, da eseguire prima del primo paint: mette `data-intro="1"` sull'elemento radice,
 * e il CSS di app-intro.css mostra il velo. Se cambia shouldPlayIntro, cambia anche qui (li prova app-intro.test.ts).
 */
export const INTRO_INIT_SCRIPT = `
(function () {
  try {
    var q = location.search;
    if (/[?&]intro=0(&|$)/.test(q)) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    var forced = /[?&]intro=1(&|$)/.test(q);
    var standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      window.matchMedia("(display-mode: fullscreen)").matches ||
      window.matchMedia("(display-mode: minimal-ui)").matches ||
      window.navigator.standalone === true ||
      document.referrer.indexOf("android-app://") === 0;
    var seen = localStorage.getItem("${INTRO_SEEN_KEY}") === "1";
    if (forced || (standalone && !seen)) document.documentElement.setAttribute("data-intro", "1");
  } catch (e) {}
})();
`;
