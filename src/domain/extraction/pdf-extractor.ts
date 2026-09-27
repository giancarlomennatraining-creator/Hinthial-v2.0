import type { PDFDocumentProxy } from "pdfjs-dist";
import { recognizeImage } from "@/domain/extraction/ocr-extractor";
import { loadPdfjs } from "@/lib/pdf";
import {
  normalizeExtractedText,
  type ExtractionProgress,
  type TextExtractor,
} from "@/domain/extraction/types";

/**
 * Estrae il testo di un PDF con pdf.js, nel browser. Due strade: un PDF "nato digitale" porta già il proprio testo
 * (istantaneo); uno scansionato (FASE 17d, la maggioranza in pratica: referti, atti) non ha testo --- si disegnano le
 * pagine e si leggono con l'OCR, come una foto.
 */

/** Sotto questa soglia il livello di testo si considera assente, non scarso --- una scansione spesso porta comunque qualche carattere di scarto. */
const MIN_TEXT_LAYER_CHARS = 40;

/** Otto pagine coprono il grosso di ciò che si scansiona; oltre, il guadagno lo taglierebbe comunque MAX_EXTRACTED_CHARS. */
const MAX_OCR_PAGES = 8;

/** Tesseract lavora male sotto ~150 DPI e non migliora granché sopra ~200 --- su un A4, 1700px sta in mezzo. */
const OCR_RENDER_WIDTH = 1700;

/** Il testo che il PDF porta già con sé, senza guardare i pixel. */
async function readTextLayer(doc: PDFDocumentProxy): Promise<string | null> {
  const pages: string[] = [];
  for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber++) {
    const page = await doc.getPage(pageNumber);
    const content = await page.getTextContent();

    // pdf.js dà frammenti, non righe --- `hasEOL` dice dove finisce la riga, altrimenti il testo mostrato (FASE 17e) sarebbe un unico blocco.
    let text = "";
    for (const item of content.items) {
      if (!("str" in item)) continue;
      text += item.str + (item.hasEOL ? "\n" : " ");
    }
    pages.push(text);

    page.cleanup();
  }
  // Riga vuota tra le pagine: il salto più grande che normalizeExtractedText conserva.
  return normalizeExtractedText(pages.join("\n\n"));
}

/** Disegna le pagine e le legge con l'OCR --- per i PDF che sono di fatto una pila di fotografie. Null (non un errore) senza canvas utilizzabile (jsdom nei test). */
async function ocrScannedPages(
  doc: PDFDocumentProxy,
  onProgress?: ExtractionProgress,
): Promise<string | null> {
  if (typeof document === "undefined") return null;

  // Sonda di capacità: jsdom crea un canvas ma non sa disegnarci --- OffscreenCanvas implica un contesto 2D vero.
  if (typeof OffscreenCanvas === "undefined") return null;

  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) return null;

  const pageCount = Math.min(doc.numPages, MAX_OCR_PAGES);
  const pages: string[] = [];

  for (let pageNumber = 1; pageNumber <= pageCount; pageNumber++) {
    const page = await doc.getPage(pageNumber);
    try {
      const unscaled = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: OCR_RENDER_WIDTH / unscaled.width });
      canvas.width = Math.round(viewport.width);
      canvas.height = Math.round(viewport.height);

      // Pagine con trasparenza arriverebbero all'OCR su fondo nero senza questo.
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);

      await page.render({ canvas, viewport }).promise;

      const pageText = await recognizeImage(canvas, (fraction) =>
        onProgress?.((pageNumber - 1 + fraction) / pageCount),
      );
      // Il filtro anti-spazzatura vale per pagina: il retro bianco di un foglio non deve rovinare le altre.
      if (pageText) pages.push(pageText);
    } finally {
      page.cleanup();
    }
  }

  // Otto pagine A4 a 1700px sono parecchi megabyte da non lasciarsi dietro su un telefono.
  canvas.width = 0;
  canvas.height = 0;

  return pages.length > 0 ? normalizeExtractedText(pages.join("\n\n")) : null;
}

export const pdfTextExtractor: TextExtractor = {
  name: "pdf.js (sul dispositivo)",

  supports(mimeType: string): boolean {
    return mimeType === "application/pdf";
  },

  async extract(
    bytes: Uint8Array,
    _mimeType: string,
    onProgress?: ExtractionProgress,
  ): Promise<string | null> {
    const pdfjs = await loadPdfjs();

    // pdf.js prende possesso del buffer ("detach"): si passa una copia, i byte originali servono ancora per cifrarlo.
    const data = new Uint8Array(bytes);

    // `destroy()` vive sul loading task, non sul documento (pdf.js v6) --- va chiamato in ogni caso per chiudere il worker.
    const loadingTask = pdfjs.getDocument({ data });
    try {
      const doc = await loadingTask.promise;

      const textLayer = await readTextLayer(doc);
      if (textLayer && textLayer.length >= MIN_TEXT_LAYER_CHARS) return textLayer;

      // Nessun testo: è una scansione. Si guardano i pixel.
      const scanned = await ocrScannedPages(doc, onProgress);
      return scanned ?? textLayer;
    } finally {
      await loadingTask.destroy();
    }
  },
};
