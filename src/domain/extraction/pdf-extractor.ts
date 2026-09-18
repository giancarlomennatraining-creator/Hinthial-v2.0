import type { PDFDocumentProxy } from "pdfjs-dist";
import { recognizeImage } from "@/domain/extraction/ocr-extractor";
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
    pages.push(content.items.map((item) => ("str" in item ? item.str : "")).join(" "));
    page.cleanup();
  }
  return normalizeExtractedText(pages.join("\n"));
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

  return pages.length > 0 ? normalizeExtractedText(pages.join("\n")) : null;
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
    // Build `legacy` e non quello moderno: è l'unico che funziona anche
    // fuori dal browser --- pdf.js stesso lo raccomanda per Node. Così
    // i test unitari esercitano esattamente lo stesso codice che gira
    // in produzione, invece di una variante diversa. Costa qualcosa in
    // dimensione, ma essendo caricato solo quando arriva davvero un PDF
    // (v. sotto) non pesa su chi non ne carica mai.
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");

    // Il worker va indicato esplicitamente **solo nel browser**: senza,
    // pdf.js prova a dedurne il percorso e in un bundle non lo trova.
    // `new URL(..., import.meta.url)` lascia che sia il bundler a
    // risolverlo e a servirlo come asset.
    //
    // Non si sovrascrive una configurazione già presente: fuori dal
    // browser (i test unitari girano in jsdom, dove `window` esiste ma
    // il loader ESM di Node accetta solo file:/data:) chi chiama può
    // indicare il worker per conto proprio. Il percorso browser vero
    // resta coperto dal test e2e che cerca dentro un PDF caricato.
    if (!pdfjs.GlobalWorkerOptions.workerSrc && typeof window !== "undefined") {
      pdfjs.GlobalWorkerOptions.workerSrc = new URL(
        "pdfjs-dist/legacy/build/pdf.worker.min.mjs",
        import.meta.url,
      ).toString();
    }

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
