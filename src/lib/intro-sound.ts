/**
 * Il suono dell'entrata (v. lib/app-intro.ts): meditativo, senza melodia. Un fondo basso che respira, tre colpi di campana
 * tibetana che risuonano a lungo (le campane hanno parziali non armoniche e due onde appena stonate, da cui il lento
 * "battito" tipico), un soffio d'aria, il tutto in uno spazio di riverbero morbido. Sintetizzato al momento con Web Audio,
 * quindi nessun file da scaricare. Segue i tempi dell'animazione in app-intro.css: la luce che sboccia, il logo che emerge,
 * il nome che compare, l'uscita.
 * Nota il limite dei browser: senza un gesto dell'utente l'audio parte solo per un'app installata sulla schermata Home;
 * altrove il contesto resta sospeso e l'entrata si vede senza suono.
 */

import { INTRO_SOUND_KEY } from "@/lib/app-intro";

export interface IntroSound {
  /** Spegne il suono con una breve dissolvenza (per il tocco che salta l'entrata). */
  stop: () => void;
}

type AudioContextCtor = typeof AudioContext;

// Re: un centro stabile e aperto. Fondo e campane sulle sue note.
const D2 = 73.42;
const A2 = 110;
const D3 = 146.83;
const D4 = 293.66;
const A4 = 440;

/** Il rapporto tra le parziali di una campana tibetana: non sono multipli interi, ed è questo a dare il timbro. */
const BOWL_PARTIALS: [ratio: number, gain: number, decay: number][] = [
  [1, 1, 1],
  [2.76, 0.42, 0.62],
  [5.4, 0.16, 0.35],
];

/** Una risposta d'ambiente sintetica: rumore che si spegne in modo esponenziale, per un riverbero largo e morbido. */
function impulseResponse(ctx: AudioContext, seconds: number, decay: number): AudioBuffer {
  const length = Math.floor(ctx.sampleRate * seconds);
  const buffer = ctx.createBuffer(2, length, ctx.sampleRate);
  for (let channel = 0; channel < 2; channel++) {
    const data = buffer.getChannelData(channel);
    for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
  }
  return buffer;
}

export async function startIntroSound(): Promise<IntroSound | null> {
  const Ctor: AudioContextCtor | undefined =
    window.AudioContext ?? (window as unknown as { webkitAudioContext?: AudioContextCtor }).webkitAudioContext;
  if (!Ctor) return null;

  // Chi l'ha spenta nelle Impostazioni (Entrata dell'app) non la sente.
  try {
    if (window.localStorage.getItem(INTRO_SOUND_KEY) === "off") return null;
  } catch {
    // Senza memoria del browser il suono resta acceso.
  }

  // Senza un gesto dell'utente il browser lascia partire l'audio solo per un'app installata: altrove non si prova nemmeno,
  // così non resta un avviso in console per un suono che non potrebbe partire.
  const installed = ["standalone", "fullscreen", "minimal-ui"].some((mode) => window.matchMedia(`(display-mode: ${mode})`).matches);
  const userActive = (navigator as Navigator & { userActivation?: { hasBeenActive: boolean } }).userActivation?.hasBeenActive;
  if (!installed && !userActive) return null;

  let ctx: AudioContext;
  try {
    ctx = new Ctor();
    if (ctx.state === "suspended") {
      // Un'app installata può partire da sola; altrove il browser aspetta un gesto, e allora niente suono.
      await Promise.race([ctx.resume(), new Promise((resolve) => setTimeout(resolve, 200))]);
    }
  } catch {
    return null;
  }
  if (ctx.state !== "running") {
    void ctx.close().catch(() => {});
    return null;
  }

  const t0 = ctx.currentTime + 0.05;

  // Il percorso: tutto passa dal "bus"; da lì una parte va dritta all'uscita, una al riverbero.
  const master = ctx.createGain();
  master.gain.setValueAtTime(0.0001, t0);
  master.gain.exponentialRampToValueAtTime(0.55, t0 + 0.6);
  master.gain.setValueAtTime(0.55, t0 + 2.7);
  master.gain.exponentialRampToValueAtTime(0.0001, t0 + 3.5);
  const compressor = ctx.createDynamicsCompressor();
  master.connect(compressor).connect(ctx.destination);

  const bus = ctx.createGain();
  const dry = ctx.createGain();
  dry.gain.value = 0.75;
  const reverb = ctx.createConvolver();
  reverb.buffer = impulseResponse(ctx, 2.6, 2.6);
  const wet = ctx.createGain();
  wet.gain.value = 0.5;
  bus.connect(dry).connect(master);
  bus.connect(reverb).connect(wet).connect(master);

  /** Un'onda con salita morbida e discesa lenta. */
  function tone(freq: number, at: number, length: number, peak: number, attack: number, detune = 0) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    osc.detune.value = detune;
    gain.gain.setValueAtTime(0.0001, t0 + at);
    gain.gain.exponentialRampToValueAtTime(peak, t0 + at + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + at + length);
    osc.connect(gain).connect(bus);
    osc.start(t0 + at);
    osc.stop(t0 + at + length + 0.05);
  }

  /** Un colpo di campana tibetana: tre parziali non armoniche, ognuna doppia e appena stonata (il battito), che risuonano a lungo. */
  function bowl(freq: number, at: number, length: number, peak: number) {
    for (const [ratio, gain, decay] of BOWL_PARTIALS) {
      tone(freq * ratio, at, length * decay, peak * gain, 0.012, -2);
      tone(freq * ratio, at, length * decay, peak * gain * 0.8, 0.012, 2.5);
    }
  }

  /** Un soffio d'aria che sale o scende, lento e senza spigoli. */
  function breath(at: number, length: number, fromHz: number, toHz: number, peak: number) {
    const frames = Math.floor(ctx.sampleRate * length);
    const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.Q.value = 0.6;
    filter.frequency.setValueAtTime(fromHz, t0 + at);
    filter.frequency.exponentialRampToValueAtTime(toHz, t0 + at + length);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t0 + at);
    gain.gain.exponentialRampToValueAtTime(peak, t0 + at + length * 0.55);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + at + length);
    src.connect(filter).connect(gain).connect(bus);
    src.start(t0 + at);
  }

  // Il fondo: Re basso, la quinta e l'ottava, che crescono piano con la luce. Due onde appena stonate fanno un lento battito.
  tone(D2, 0.05, 3.3, 0.17, 1.2);
  tone(D2, 0.05, 3.3, 0.1, 1.4, 6);
  tone(A2, 0.3, 3.1, 0.1, 1.2);
  tone(D3, 0.5, 2.9, 0.08, 1.2);
  tone(D3, 0.5, 2.9, 0.06, 1.4, -7);

  // Un respiro che sale mentre la luce sboccia, e uno che scende all'uscita.
  breath(0.2, 1.7, 260, 1500, 0.07);
  breath(2.75, 0.75, 1500, 240, 0.05);

  // Tre colpi di campana: all'inizio (la luce), sul logo (a 1,1 s) e sul nome (a 1,75 s).
  bowl(D4, 0.1, 3.4, 0.1);
  bowl(A4, 1.1, 2.6, 0.075);
  bowl(D4 / 2, 1.75, 1.9, 0.11);

  // Un'ultima eco alta e quasi impercettibile quando passa il riflesso sul nome (a 2,5 s).
  tone(1174.66, 2.5, 0.9, 0.02, 0.15);

  const closeTimer = window.setTimeout(() => void ctx.close().catch(() => {}), 4200);

  return {
    stop() {
      window.clearTimeout(closeTimer);
      try {
        master.gain.cancelScheduledValues(ctx.currentTime);
        master.gain.setValueAtTime(Math.max(master.gain.value, 0.0001), ctx.currentTime);
        master.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.2);
      } catch {
        // Il contesto potrebbe essere già chiuso.
      }
      window.setTimeout(() => void ctx.close().catch(() => {}), 300);
    },
  };
}
