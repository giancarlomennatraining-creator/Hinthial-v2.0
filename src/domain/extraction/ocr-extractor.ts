import type { Worker as TesseractWorker } from "tesseract.js";
import { buildExtractedContent } from "@/domain/extraction/content";
import { inspectImage } from "@/domain/extraction/technical";
import {
  normalizeExtractedText,
  type ExtractedContent,
  type ExtractionProgress,
  type TextExtractor,
} from "@/domain/extraction/types";

/** FASE 17c: OCR delle immagini, tutto sul dispositivo --- anche i file del motore arrivano dal nostro dominio, non da una CDN (v. scripts/sync-ocr-assets.mjs). */

/** HEIC resta fuori: nessun browser lo decodifica nativamente, e iOS lo converte già in JPEG al caricamento. */
const OCR_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/bmp",
  "image/gif",
]);

/** Solo italiano --- v. scripts/sync-ocr-assets.mjs per il perché. */
const OCR_LANGUAGES = "ita";

/** Registrata con ogni risultato: va cambiata quando cambiano motore o lingua, perché lo stesso file potrebbe leggersi diversamente. */
const OCR_ENGINE_VERSION = "tesseract.js-7-ita-lstm";

/** Serviti da noi, non dalla CDN di default di tesseract.js --- copiati in `public/ocr/` prima di dev/build/e2e. */
const OCR_PATHS = {
  workerPath: "/ocr/worker.min.js",
  corePath: "/ocr/tesseract-core-simd-lstm.wasm.js",
  langPath: "/ocr/lang",
};

/** Avviare il motore costa (WASM da compilare, modello da decomprimere) --- un minuto acceso copre più file di seguito senza sprecare memoria oltre. */
const IDLE_SHUTDOWN_MS = 60_000;

let enginePromise: Promise<TesseractWorker> | null = null;
let idleTimer: ReturnType<typeof setTimeout> | null = null;
let running = 0;

/** Il logger di tesseract.js si imposta alla nascita del motore, non per lavoro --- le estrazioni sono comunque sempre sequenziali. */
let reportProgress: ExtractionProgress | null = null;

async function ocrEngine(): Promise<TesseractWorker> {
  if (enginePromise) return enginePromise;

  // Import dinamico: tesseract.js pesa parecchio, non deve toccare chi carica un PDF o scrive una nota.
  const started = (async () => {
    const { createWorker, OEM } = await import("tesseract.js");
    return createWorker(OCR_LANGUAGES, OEM.LSTM_ONLY, {
      ...OCR_PATHS,
      logger: (message) => {
        // Solo il riconoscimento vero ha un avanzamento confrontabile (ed è anche la parte lunga).
        if (message.status === "recognizing text") reportProgress?.(message.progress);
      },
    });
  })();

  enginePromise = started;
  // Un avvio fallito non resta in cache come promessa rifiutata --- il prossimo tentativo riparte da zero.
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

/** Un OCR non dice mai "non c'è niente" (una foto sfocata dà comunque simboli slegati) --- due condizioni, confidenza e un minimo di sostanza, evitano di riempire la ricerca di spazzatura. */
export function looksLikeRealText(text: string, confidence: number): boolean {
  if (confidence < MIN_OCR_CONFIDENCE) return false;
  const words = text.match(/[\p{L}\p{N}]{3,}/gu);
  return (words?.length ?? 0) >= MIN_OCR_WORDS;
}

/** Legge un Blob o un canvas (così si leggono le pagine di un PDF scansionato, v. pdf-extractor.ts); null se non sembra testo vero. */
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

  async extractContent(
    bytes: Uint8Array,
    mimeType: string,
    onProgress?: ExtractionProgress,
  ): Promise<ExtractedContent> {
    // Blob, non byte grezzi: la decodifica JPEG/PNG del browser è molto più rapida di quella di tesseract.js.
    const text = await recognizeImage(new Blob([bytes as BlobPart], { type: mimeType }), onProgress);

    return buildExtractedContent({
      // Un'immagine è una pagina sola.
      pages: text ? [{ index: 1, text }] : [],
      technical: { ...inspectImage(bytes, mimeType), pageCount: 1, pagesRead: 1 },
      extraction: { extractor: "tesseract", version: OCR_ENGINE_VERSION, ocr: true },
    });
  },
};
