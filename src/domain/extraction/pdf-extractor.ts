import { normalizeExtractedText, type TextExtractor } from "@/domain/extraction/types";

/**
 * Estrae il testo di un PDF con pdf.js, nel browser --- v. types.ts per
 * il perché "nel browser" è il punto centrale, non un dettaglio.
 *
 * `import()` dinamico: pdf.js pesa oltre un megabyte e servirebbe a
 * chiunque carichi qualunque contenuto, anche una foto o una nota.
 * Caricato solo nell'istante in cui arriva davvero un PDF --- stessa
 * scelta già fatta per `qrcode` (v. SetupMasterKeyForm).
 *
 * Un PDF di sole scansioni non contiene testo: qui restituisce null
 * (non un errore), e sarà l'OCR di un passo successivo a leggerlo.
 */
export const pdfTextExtractor: TextExtractor = {
  name: "pdf.js (sul dispositivo)",

  supports(mimeType: string): boolean {
    return mimeType === "application/pdf";
  },

  async extract(bytes: Uint8Array): Promise<string | null> {
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
      const pages: string[] = [];
      for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber++) {
        const page = await doc.getPage(pageNumber);
        const content = await page.getTextContent();
        pages.push(content.items.map((item) => ("str" in item ? item.str : "")).join(" "));
        page.cleanup();
      }
      return normalizeExtractedText(pages.join("\n"));
    } finally {
      await loadingTask.destroy();
    }
  },
};
