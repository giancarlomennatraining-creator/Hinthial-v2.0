/**
 * pdf.js, caricato e configurato in un punto solo: l'OCR (v. domain/extraction/pdf-extractor.ts) e la scheda di un
 * contenuto hanno entrambi bisogno di disegnare le pagine di un PDF, e la preparazione (import dinamico, worker) è
 * delicata e identica per entrambi.
 */

import type { PageTextItem } from "@/domain/ai/analysis/page-highlight";

/**
 * Carica pdf.js e si assicura che il worker sia configurato. Build `legacy` (non quello moderno): è l'unico che
 * funziona anche fuori dal browser, così i test unitari esercitano lo stesso codice della produzione. `import()`
 * dinamico: pdf.js pesa oltre un megabyte, si carica solo quando c'è davvero un PDF da aprire.
 */
export async function loadPdfjs() {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");

  // Il worker va indicato esplicitamente solo nel browser: senza, pdf.js non lo trova in un bundle.
  // `new URL(..., import.meta.url)` lascia che sia il bundler a risolverlo. Non si sovrascrive una
  // configurazione già presente: fuori dal browser chi chiama può indicare il worker per conto proprio.
  if (!pdfjs.GlobalWorkerOptions.workerSrc && typeof window !== "undefined") {
    pdfjs.GlobalWorkerOptions.workerSrc = new URL(
      "pdfjs-dist/legacy/build/pdf.worker.min.mjs",
      import.meta.url,
    ).toString();
  }

  return pdfjs;
}

/** Larghezza a cui si disegna l'anteprima --- abbastanza per leggerla a schermo intero. */
const DEFAULT_PREVIEW_WIDTH = 1200;

export interface PdfFirstPage {
  /** La prima pagina disegnata, pronta da mostrare in un <img>. */
  image: Blob;
  /** Quante pagine ha il documento --- per dire "prima di N". */
  pageCount: number;
}

export interface PdfPageWithText {
  image: Blob;
  width: number;
  height: number;
  /** Matrice del viewport con cui è stata disegnata: serve a portare le coordinate del testo sull'immagine. */
  transform: number[];
  /** Gli elementi di testo della pagina (vuoti per una scansione senza testo). */
  items: PageTextItem[];
}

/** Disegna la pagina `pageNumber` e ne restituisce anche il testo con le coordinate, per evidenziarvi una frase. Null dove non si può disegnare. */
export async function renderPdfPageWithText(
  bytes: Uint8Array,
  pageNumber: number,
  width = DEFAULT_PREVIEW_WIDTH,
): Promise<PdfPageWithText | null> {
  if (typeof document === "undefined" || typeof OffscreenCanvas === "undefined") return null;

  const pdfjs = await loadPdfjs();
  const loadingTask = pdfjs.getDocument({ data: new Uint8Array(bytes) });
  try {
    const doc = await loadingTask.promise;
    if (pageNumber < 1 || pageNumber > doc.numPages) return null;
    const page = await doc.getPage(pageNumber);
    try {
      const unscaled = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: width / unscaled.width });

      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");
      if (!context) return null;
      canvas.width = Math.round(viewport.width);
      canvas.height = Math.round(viewport.height);
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvas, viewport }).promise;

      const content = await page.getTextContent();
      const items: PageTextItem[] = [];
      for (const item of content.items) {
        if ("str" in item) {
          items.push({ str: item.str, transform: item.transform, width: item.width, height: item.height });
        }
      }

      const image = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
      const result = image
        ? { image, width: canvas.width, height: canvas.height, transform: [...viewport.transform], items }
        : null;
      canvas.width = 0;
      canvas.height = 0;
      return result;
    } finally {
      page.cleanup();
    }
  } finally {
    await loadingTask.destroy();
  }
}

/** Disegna la prima pagina di un PDF come anteprima. Restituisce null (non un errore) dove non si può disegnare: chi chiama mostra semplicemente il messaggio di ripiego. */
export async function renderPdfFirstPage(
  bytes: Uint8Array,
  width = DEFAULT_PREVIEW_WIDTH,
): Promise<PdfFirstPage | null> {
  // Sonda di capacità (v. pdf-extractor.ts): jsdom un canvas lo crea ma non sa disegnarci.
  if (typeof document === "undefined" || typeof OffscreenCanvas === "undefined") return null;

  const pdfjs = await loadPdfjs();

  // pdf.js prende possesso del buffer che riceve: si passa una copia, altrimenti chi chiama si ritrova i byte svuotati.
  const loadingTask = pdfjs.getDocument({ data: new Uint8Array(bytes) });
  try {
    const doc = await loadingTask.promise;
    const page = await doc.getPage(1);
    try {
      const unscaled = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: width / unscaled.width });

      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");
      if (!context) return null;

      canvas.width = Math.round(viewport.width);
      canvas.height = Math.round(viewport.height);
      // Le pagine con trasparenze arriverebbero su fondo nero.
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);

      await page.render({ canvas, viewport }).promise;

      // JPEG e non PNG: una pagina scansionata è una fotografia, e in PNG
      // peserebbe alcuni megabyte per un'anteprima che si guarda e basta.
      const image = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", 0.85),
      );

      // Si libera la memoria del canvas invece di lasciarla al garbage
      // collector: una pagina A4 a 1200 pixel sono diversi megabyte.
      canvas.width = 0;
      canvas.height = 0;

      return image ? { image, pageCount: doc.numPages } : null;
    } finally {
      page.cleanup();
    }
  } finally {
    await loadingTask.destroy();
  }
}
