import type { PDFDocumentProxy } from "pdfjs-dist";
import { recognizeImage } from "@/domain/extraction/ocr-extractor";
import { loadPdfjs } from "@/lib/pdf";
import {
  normalizeExtractedText,
  type ExtractionProgress,
  type TextExtractor,
} from "@/domain/extraction/types";

/**
 * Estrae il testo di un PDF con pdf.js, nel browser --- v. types.ts per
 * il perché "nel browser" è il punto centrale, non un dettaglio.
 *
 * `import()` dinamico: pdf.js pesa oltre un megabyte e servirebbe a
 * chiunque carichi qualunque contenuto, anche una foto o una nota.
 * Caricato solo nell'istante in cui arriva davvero un PDF --- stessa
 * scelta già fatta per `qrcode` (v. SetupMasterKeyForm).
 *
 * Due strade, e la seconda è quella che conta di più nella pratica
 * (FASE 17d). Un PDF "nato digitale" (una fattura, un estratto conto)
 * porta con sé il proprio testo, e pdf.js lo restituisce in un istante.
 * Un PDF scansionato --- praticamente ogni referto medico, ogni atto, ogni
 * documento passato per uno sportello --- non contiene testo: contiene
 * la fotografia di un foglio. Lì si disegnano le pagine e si leggono con
 * l'OCR, esattamente come si farebbe con una foto.
 */

/**
 * Sotto questa soglia il livello di testo si considera assente, non
 * scarso. Un PDF scansionato non restituisce sempre la stringa vuota:
 * spesso contiene un numero di pagina, un'intestazione vettoriale o
 * qualche carattere di scarto. Quaranta caratteri sono più di così e
 * molto meno di qualunque documento vero.
 */
const MIN_TEXT_LAYER_CHARS = 40;

/**
 * Quante pagine si leggono con l'OCR al massimo.
 *
 * Ogni pagina costa qualche secondo, e l'attesa è dentro il salvataggio
 * del documento. Otto pagine coprono referti, ricette, contratti e atti
 * (il grosso di ciò che si scansiona); un faldone da cento pagine
 * bloccherebbe l'utente per dieci minuti per un guadagno che i primi
 * 200.000 caratteri (v. MAX_EXTRACTED_CHARS) taglierebbero comunque.
 */
const MAX_OCR_PAGES = 8;

/**
 * Larghezza a cui si disegna ogni pagina prima di passarla all'OCR.
 * Tesseract lavora male sotto i ~150 DPI e non migliora granché sopra i
 * ~200: su un A4, 1700 pixel di larghezza stanno in mezzo. Più grande
 * vorrebbe solo dire più memoria e più secondi.
 */
const OCR_RENDER_WIDTH = 1700;

/** Il testo che il PDF porta già con sé, senza guardare i pixel. */
async function readTextLayer(doc: PDFDocumentProxy): Promise<string | null> {
  const pages: string[] = [];
  for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber++) {
    const page = await doc.getPage(pageNumber);
    const content = await page.getTextContent();

    // pdf.js restituisce frammenti, non righe, ma sa dove la riga finisce
    // (`hasEOL`): senza guardarlo, un documento intero tornerebbe come
    // un unico periodo lunghissimo. Per la ricerca era indifferente; da
    // quando il testo si mostra all'utente non lo è più (v. FASE 17e).
    let text = "";
    for (const item of content.items) {
      if (!("str" in item)) continue;
      text += item.str + (item.hasEOL ? "\n" : " ");
    }
    pages.push(text);

    page.cleanup();
  }
  // Riga vuota tra una pagina e l'altra: è il salto più grande che
  // normalizeExtractedText conserva.
  return normalizeExtractedText(pages.join("\n\n"));
}

/**
 * Disegna le pagine e le legge con l'OCR --- la strada per i PDF che
 * sono, di fatto, una pila di fotografie.
 *
 * Restituisce null (non un errore) dove non c'è un canvas utilizzabile:
 * fuori da un browser vero --- i test unitari girano in jsdom, che un
 * canvas lo crea ma senza contesto di disegno --- non c'è nulla su cui
 * disegnare, e l'estrazione è comunque best-effort.
 */
async function ocrScannedPages(
  doc: PDFDocumentProxy,
  onProgress?: ExtractionProgress,
): Promise<string | null> {
  if (typeof document === "undefined") return null;

  // Sonda di capacità, non un errore da gestire: jsdom (dove girano i
  // test unitari) un canvas lo crea ma non sa disegnarci, e chiamargli
  // `getContext()` significa solo raccogliere un'eccezione rumorosa.
  // Ogni browser che ha OffscreenCanvas ha di sicuro anche un contesto
  // 2D vero --- qui serve solo a sapere in che mondo siamo.
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

      // Le pagine scansionate sono opache, ma quelle con trasparenze
      // arriverebbero all'OCR su fondo nero: si riempie di bianco prima
      // di disegnare.
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);

      await page.render({ canvas, viewport }).promise;

      // L'avanzamento di una pagina è una frazione dell'intero: senza
      // questo, una scansione di otto pagine mostrerebbe otto volte una
      // barra che va da 0 a 100.
      const pageText = await recognizeImage(canvas, (fraction) =>
        onProgress?.((pageNumber - 1 + fraction) / pageCount),
      );
      // Il filtro anti-spazzatura vale per pagina e non per documento:
      // il retro bianco di un foglio non deve rovinare il testo delle
      // pagine che invece si leggono benissimo (v. looksLikeRealText).
      if (pageText) pages.push(pageText);
    } finally {
      page.cleanup();
    }
  }

  // Si libera la memoria del canvas: su un telefono, otto pagine A4 a
  // 1700 pixel sono parecchi megabyte da non lasciarsi dietro.
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
    // Import dinamico e worker: v. lib/pdf.ts, condiviso con
    // l'anteprima della prima pagina (FASE 17e).
    const pdfjs = await loadPdfjs();

    // pdf.js prende possesso del buffer che riceve (lo "detacha"): si
    // passa una copia, altrimenti chi chiama si ritrova i byte del file
    // svuotati subito dopo --- e quelli servono ancora per cifrarlo.
    const data = new Uint8Array(bytes);

    // `destroy()` vive sul loading task, non sul documento (pdf.js v6):
    // va tenuto per poter chiudere il worker in ogni caso.
    const loadingTask = pdfjs.getDocument({ data });
    try {
      const doc = await loadingTask.promise;

      const textLayer = await readTextLayer(doc);
      if (textLayer && textLayer.length >= MIN_TEXT_LAYER_CHARS) return textLayer;

      // Nessun testo: è una scansione. Si guardano i pixel.
      const scanned = await ocrScannedPages(doc, onProgress);
      // Se anche l'OCR non trova nulla si tiene comunque il poco testo
      // del livello testuale, se c'era: è pur sempre più di niente.
      return scanned ?? textLayer;
    } finally {
      await loadingTask.destroy();
    }
  },
};
