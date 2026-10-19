/**
 * Il suono dell'entrata (v. lib/app-intro.ts): calmo, sintetizzato al momento con Web Audio, quindi nessun file da scaricare.
 * Segue i tempi dell'animazione in app-intro.css: la luce che sboccia, un lampo sul logo, il nome che si compone, l'uscita.
 * Nota il limite dei browser: senza un gesto dell'utente l'audio parte solo per un'app installata sulla schermata Home;
 * altrove il contesto resta sospeso e l'entrata si vede senza suono.
 */

import { INTRO_SOUND_KEY } from "@/lib/app-intro";

export interface IntroSound {
  /** Spegne il suono con una breve dissolvenza (per il tocco che salta l'entrata). */
  stop: () => void;
}

type AudioContextCtor = typeof AudioContext;

// Re maggiore con la nona: accogliente, senza tensione.
const D3 = 146.83;
const A3 = 220;
const FS4 = 369.99;
const E5 = 659.25;
const NOTES_ARP = [587.33, 739.99, 880, 1318.51]; // D5, F#5, A5, E6
const CHIME = 1174.66; // D6
const SPARKLE = [1760, 2349.32, 2959.96]; // A6, D7, F#7

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
  const master = ctx.createGain();
  master.gain.setValueAtTime(0.0001, t0);
  master.gain.exponentialRampToValueAtTime(0.34, t0 + 0.5);
  master.gain.setValueAtTime(0.34, t0 + 2.8);
  master.gain.exponentialRampToValueAtTime(0.0001, t0 + 3.5);
  const compressor = ctx.createDynamicsCompressor();
  master.connect(compressor).connect(ctx.destination);

  /** Una nota con attacco e rilascio morbidi. */
  function tone(freq: number, at: number, length: number, peak: number, type: OscillatorType, attack = 0.02, detune = 0) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    osc.detune.value = detune;
    gain.gain.setValueAtTime(0.0001, t0 + at);
    gain.gain.exponentialRampToValueAtTime(peak, t0 + at + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + at + length);
    osc.connect(gain).connect(master);
    osc.start(t0 + at);
    osc.stop(t0 + at + length + 0.05);
  }

  /** Un campanello morbido: la nota e una parziale alta che svanisce prima. */
  function bell(freq: number, at: number, length: number, peak: number) {
    tone(freq, at, length, peak, "sine", 0.01);
    tone(freq * 2.76, at, length * 0.35, peak * 0.22, "sine", 0.005);
  }

  /** Un soffio di rumore filtrato che sale o scende: il lampo di luce, l'uscita. */
  function whoosh(at: number, length: number, fromHz: number, toHz: number, peak: number) {
    const frames = Math.floor(ctx.sampleRate * length);
    const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.Q.value = 0.9;
    filter.frequency.setValueAtTime(fromHz, t0 + at);
    filter.frequency.exponentialRampToValueAtTime(toHz, t0 + at + length);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t0 + at);
    gain.gain.exponentialRampToValueAtTime(peak, t0 + at + length * 0.45);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + at + length);
    src.connect(filter).connect(gain).connect(master);
    src.start(t0 + at);
  }

  // Il tappeto: quattro note lunghe che crescono con la luce, e un fondo basso che si spegne all'uscita.
  const padLength = 3.2;
  for (const [freq, peak, detune] of [
    [D3, 0.16, 0],
    [A3, 0.12, 4],
    [FS4, 0.07, -5],
    [E5, 0.035, 3],
  ] as const) {
    tone(freq, 0.05, padLength, peak, "sine", 1.1, detune);
    tone(freq, 0.05, padLength, peak * 0.5, "triangle", 1.3, -detune);
  }
  tone(73.42, 0.2, 3.0, 0.1, "sine", 1.0); // D2

  // Le prime scintille mentre sboccia la luce.
  NOTES_ARP.forEach((freq, i) => bell(freq, 0.45 + i * 0.27, 1.1, 0.07));

  // Il lampo sul logo (a 1,15 s nell'animazione) e la campana quando appare il nome (a 1,8 s).
  whoosh(1.1, 0.9, 500, 3200, 0.16);
  bell(CHIME, 1.35, 1.6, 0.1);
  bell(CHIME / 2, 1.85, 1.5, 0.08);

  // Il riflesso che passa sul nome (a 2,55 s) e l'uscita (da 2,9 s).
  SPARKLE.forEach((freq, i) => bell(freq, 2.55 + i * 0.1, 0.5, 0.035));
  whoosh(2.85, 0.65, 2400, 220, 0.1);

  const closeTimer = window.setTimeout(() => void ctx.close().catch(() => {}), 4200);

  return {
    stop() {
      window.clearTimeout(closeTimer);
      try {
        master.gain.cancelScheduledValues(ctx.currentTime);
        master.gain.setValueAtTime(Math.max(master.gain.value, 0.0001), ctx.currentTime);
        master.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.15);
      } catch {
        // Il contesto potrebbe essere già chiuso.
      }
      window.setTimeout(() => void ctx.close().catch(() => {}), 250);
    },
  };
}
