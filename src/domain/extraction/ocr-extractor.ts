import type { Worker as TesseractWorker } from "tesseract.js";
import { normalizeExtractedText, type ExtractionProgress, type TextExtractor } from "@/domain/extraction/types";

/**
 * FASE 17c --- legge il testo scritto **dentro le immagini**: la foto di
 * una ricetta, lo scontrino fotografato al volo, il referto scansionato.
 * È il caso più frequente in assoluto in un archivio personale, e fino a
 * ieri per Hinthial erano file muti, cercabili solo per come si
 * chiamavano.
 *
 * Tutto sul dispositivo, come per i PDF (v. types.ts): l'immagine non
 * viene inviata da nessuna parte. Anche i file del motore arrivano dal
 * nostro dominio invece che da una CDN --- v.
 * scripts/sync-ocr-assets.mjs per il perché non è un dettaglio.
 */

/**
 * I formati che il browser sa decodificare da solo e che ha senso
 * passare all'OCR. HEIC (le foto degli iPhone) resta fuori: nessun
 * browser lo decodifica nativamente, e iOS converte comunque in JPEG
 * quando si carica un file da un sito.
 */
const OCR_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/bmp",
  "image/gif",
]);

/** Solo italiano --- v. scripts/sync-ocr-assets.mjs per il perché. */
const OCR_LANGUAGES = "ita";

/**
 * Serviti da noi, non dalla CDN di tesseract.js (che è il default).
 * Copiati in `public/ocr/` prima di dev/build/e2e.
 */
const OCR_PATHS = {
  workerPath: "/ocr/worker.min.js",
  corePath: "/ocr/tesseract-core-simd-lstm.wasm.js",
  langPath: "/ocr/lang",
};

/**
 * Quanto aspettare, finita l'ultima immagine, prima di spegnere il
 * motore. Avviarlo costa: qualche megabyte di WebAssembly da compilare e
 * il modello linguistico da decomprimere. Chi recupera venti foto dal
 * banner in Archivio lo pagherebbe venti volte. Tenerlo acceso un minuto
 * copre sia quel caso sia il caricamento di più file di seguito; oltre,
 * è solo memoria occupata per niente.
 */
const IDLE_SHUTDOWN_MS = 60_000;

let enginePromise: Promise<TesseractWorker> | null = null;
let idleTimer: ReturnType<typeof setTimeout> | null = null;
let running = 0;

/**
 * Il logger di tesseract.js si imposta alla nascita del motore, non per
 * singolo lavoro: l'avanzamento passa di qui. In pratica le estrazioni
 * sono sempre sequenziali (un caricamento alla volta, e il recupero dal
 * banner è deliberatamente in fila --- v. DocumentsPanel), quindi c'è un
 * solo destinatario per volta; se mai ne partissero due insieme, il
 * peggio che succede è una percentuale che salta. Non vale un motore in
 * più per immagine.
 */
let reportProgress: ExtractionProgress | null = null;

async function ocrEngine(): Promise<TesseractWorker> {
  if (enginePromise) return enginePromise;

  // `import()` dinamico: tesseract.js e il suo motore pesano parecchi
  // megabyte, e non devono toccare chi carica un PDF o scrive una nota
  // (stessa scelta di pdf-extractor.ts e di `qrcode`).
  const started = (async () => {
    const { createWorker, OEM } = await import("tesseract.js");
    return createWorker(OCR_LANGUAGES, OEM.LSTM_ONLY, {
      ...OCR_PATHS,
      logger: (message) => {
        // Le altre fasi (scaricamento del modello, avvio del motore) non
        // hanno un avanzamento confrontabile: si riporta solo il
        // riconoscimento vero e proprio, che è anche la parte lunga.
        if (message.status === "recognizing text") reportProgress?.(message.progress);
      },
    });
  })();

  enginePromise = started;
  // Un avvio fallito non deve restare in cache come promessa rifiutata:
  // il tentativo successivo deve poter ripartire da zero.
  started.catch(() => {
    if (enginePromise === started) enginePromise = null;
  });

  return started;
}

function scheduleIdleShutdown(): void {
  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    idleTimer = null;
    if (running > 0) return;
    const toTerminate = enginePromise;
    enginePromise = null;
    toTerminate?.then((worker) => worker.terminate()).catch(() => {});
  }, IDLE_SHUTDOWN_MS);
}

const MIN_OCR_CONFIDENCE = 55;
const MIN_OCR_WORDS = 3;

/**
 * Se vale la pena salvare quello che l'OCR ha letto.
 *
 * Un OCR non dice mai "non c'è niente": davanti a una foto sfocata, a un
 * muro o a un timbro restituisce comunque qualcosa, tipicamente una
 * manciata di simboli slegati. Salvarla significherebbe riempire la
 * ricerca di spazzatura e --- peggio --- far comparire un documento tra i
 * risultati per una parola che nessuno ci ha mai scritto.
 *
 * Due condizioni, entrambe necessarie: la confidenza dichiarata dal
 * motore, e un minimo di sostanza (almeno tre gruppi di lettere di
 * lunghezza credibile). La seconda serve perché la confidenza da sola
 * può essere alta su pochissimo testo.
 */
export function looksLikeRealText(text: string, confidence: number): boolean {
  if (confidence < MIN_OCR_CONFIDENCE) return false;
  const words = text.match(/[\p{L}\p{N}]{3,}/gu);
  return (words?.length ?? 0) >= MIN_OCR_WORDS;
}

/**
 * Legge il testo di **una** immagine già pronta --- un Blob, oppure un
 * canvas su cui qualcun altro ha disegnato (è così che si leggono le
 * pagine di un PDF scansionato, v. pdf-extractor.ts).
 *
 * Restituisce null se quello che ha letto non sembra testo (v.
 * looksLikeRealText): meglio niente che spazzatura nella ricerca.
 */
export async function recognizeImage(
  image: Blob | HTMLCanvasElement,
  onProgress?: ExtractionProgress,
): Promise<string | null> {
  const worker = await ocrEngine();

  running++;
  if (idleTimer) {
    clearTimeout(idleTimer);
    idleTimer = null;
  }
  reportProgress = onProgress ?? null;

  try {
    const { data } = await worker.recognize(image);
    const text = normalizeExtractedText(data.text);
    if (!text || !looksLikeRealText(text, data.confidence)) return null;
    return text;
  } finally {
    reportProgress = null;
    running--;
    if (running === 0) scheduleIdleShutdown();
  }
}

export const ocrTextExtractor: TextExtractor = {
  name: "Tesseract (sul dispositivo)",

  supports(mimeType: string): boolean {
    return OCR_MIME_TYPES.has(mimeType);
  },

  async extract(
    bytes: Uint8Array,
    mimeType: string,
    onProgress?: ExtractionProgress,
  ): Promise<string | null> {
    // Si passa un Blob e non i byte grezzi: la decodifica del JPEG/PNG la
    // fa il browser, che lo sa fare molto meglio (e molto più in fretta)
    // del decoder incluso in tesseract.js.
    return recognizeImage(new Blob([bytes as BlobPart], { type: mimeType }), onProgress);
  },
};
