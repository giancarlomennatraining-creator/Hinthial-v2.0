/**
 * pdf.js, caricato e configurato in un punto solo.
 *
 * Due parti dell'app hanno bisogno di disegnare le pagine di un PDF, per
 * motivi diversi: l'OCR, che le legge quando il PDF è una scansione (v.
 * domain/extraction/pdf-extractor.ts), e la scheda di un contenuto, che
 * ne mostra la prima all'utente (FASE 17e). La preparazione di pdf.js ---
 * import dinamico, worker --- è delicata e identica per entrambe: stava
 * per diventare due copie, e due copie divergono sempre.
 */

/**
 * Carica pdf.js e si assicura che il worker sia configurato.
 *
 * Build `legacy` e non quello moderno: è l'unico che funziona anche
 * fuori dal browser --- pdf.js stesso lo raccomanda per Node. Così i test
 * unitari esercitano esattamente lo stesso codice che gira in
 * produzione, invece di una variante diversa.
 *
 * `import()` dinamico: pdf.js pesa oltre un megabyte e non deve toccare
 * chi carica una foto o scrive una nota --- si carica solo nell'istante
 * in cui c'è davvero un PDF da aprire (stessa scelta fatta per `qrcode`,
 * v. SetupMasterKeyForm, e per tesseract.js).
 */
export async function loadPdfjs() {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");

  // Il worker va indicato esplicitamente **solo nel browser**: senza,
  // pdf.js prova a dedurne il percorso e in un bundle non lo trova.
  // `new URL(..., import.meta.url)` lascia che sia il bundler a
  // risolverlo e a servirlo come asset.
  //
  // Non si sovrascrive una configurazione già presente: fuori dal
  // browser (i test unitari girano in jsdom, dove `window` esiste ma il
  // loader ESM di Node accetta solo file:/data:) chi chiama può indicare
  // il worker per conto proprio. Il percorso browser vero resta coperto
  // dai test e2e.
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

/**
 * Disegna la prima pagina di un PDF, per mostrarla come anteprima.
 *
 * Restituisce null (non un errore) dove non si può disegnare: fuori da
 * un browser vero, o se il file non è un PDF valido. L'anteprima è un
 * di più --- chi chiama mostra semplicemente il messaggio di ripiego.
 */
export async function renderPdfFirstPage(
  bytes: Uint8Array,
  width = DEFAULT_PREVIEW_WIDTH,
): Promise<PdfFirstPage | null> {
  // Sonda di capacità: v. lo stesso controllo in pdf-extractor.ts ---
  // jsdom un canvas lo crea ma non sa disegnarci.
  if (typeof document === "undefined" || typeof OffscreenCanvas === "undefined") return null;

  const pdfjs = await loadPdfjs();

  // pdf.js prende possesso del buffer che riceve (lo "detacha"): si
  // passa una copia, altrimenti chi chiama si ritrova i byte svuotati.
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
