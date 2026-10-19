/**
 * L'entrata animata di Hinthial ("Aurora"): dura 3,5 secondi e lascia poi la pagina di sempre. Compare quando l'app
 * installata si apre, secondo la scelta fatta in Impostazioni (a ogni apertura, solo la prima volta, mai). La decisione
 * si prende prima del primo paint (v. INTRO_INIT_SCRIPT, uno script inline come quello del tema), così la pagina non
 * lampeggia prima dell'animazione.
 */

/** "Già vista, una volta": su questo dispositivo, per sempre. */
export const INTRO_SEEN_KEY = "hinthial-intro-seen";
/** "Già vista in questa apertura dell'app": sta in sessionStorage, che si azzera quando l'app viene chiusa del tutto. Tornare all'app da un'altra non la rifà. */
export const INTRO_SESSION_KEY = "hinthial-intro-session";
export const INTRO_MODE_KEY = "hinthial-intro-mode";
export const INTRO_SOUND_KEY = "hinthial-intro-sound";
/** Un evento della pagina per rivederla subito (dalle Impostazioni). */
export const INTRO_PLAY_EVENT = "hinthial:play-intro";

/** Quanto dura tutto, uscita compresa: lo stesso valore è scritto nei tempi di app-intro.css. */
export const INTRO_DURATION_MS = 3500;

export type IntroMode = "always" | "first" | "never";

export const INTRO_MODE_LABEL: Record<IntroMode, string> = {
  always: "A ogni apertura",
  first: "Solo la prima volta",
  never: "Mai",
};

/** La scelta salvata; senza (o con un valore sconosciuto) si parte da "a ogni apertura". */
export function parseIntroMode(raw: string | null | undefined): IntroMode {
  return raw === "first" || raw === "never" || raw === "always" ? raw : "always";
}

export interface IntroInput {
  /** La query della pagina, es. "?intro=1". */
  search: string;
  mode: IntroMode;
  /** Ha già visto l'entrata una volta su questo dispositivo. */
  seen: boolean;
  /** L'ha già vista in questa apertura dell'app. */
  seenThisSession: boolean;
  /** Aperta come app installata (schermata Home, o guscio Android): non in una scheda del browser. */
  standalone: boolean;
  /** Chi ha chiesto meno movimento non vede animazioni né sente suoni di apertura. */
  reducedMotion: boolean;
}

/**
 * Va mostrata? Nell'app installata sì, a ogni apertura (o solo alla prima, o mai: lo sceglie chi la usa); mai a chi ha
 * chiesto meno movimento. `?intro=1` la mostra comunque (per provarla da una scheda del browser), `?intro=0` la salta sempre.
 */
export function shouldPlayIntro({ search, mode, seen, seenThisSession, standalone, reducedMotion }: IntroInput): boolean {
  if (/[?&]intro=0(&|$)/.test(search)) return false;
  if (reducedMotion) return false;
  if (/[?&]intro=1(&|$)/.test(search)) return true;
  if (mode === "never" || !standalone) return false;
  return mode === "first" ? !seen : !seenThisSession;
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
    // Un telefono con poca memoria o pochi processori ha una versione più leggera (meno chiazze di luce, niente riflesso).
    if ((navigator.hardwareConcurrency || 8) <= 4 || (navigator.deviceMemory || 8) <= 3) document.documentElement.setAttribute("data-intro-lite", "1");
    if (/[?&]intro=1(&|$)/.test(q)) { document.documentElement.setAttribute("data-intro", "1"); return; }
    var mode = localStorage.getItem("${INTRO_MODE_KEY}");
    if (mode === "never") return;
    var standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      window.matchMedia("(display-mode: fullscreen)").matches ||
      window.matchMedia("(display-mode: minimal-ui)").matches ||
      window.navigator.standalone === true ||
      document.referrer.indexOf("android-app://") === 0;
    if (!standalone) return;
    var seen = mode === "first"
      ? localStorage.getItem("${INTRO_SEEN_KEY}") === "1"
      : sessionStorage.getItem("${INTRO_SESSION_KEY}") === "1";
    if (!seen) document.documentElement.setAttribute("data-intro", "1");
  } catch (e) {}
})();
`;
