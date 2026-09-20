import { renderPdfFirstPage } from "@/lib/pdf";

/**
 * La miniatura di un contenuto: la prima pagina di un PDF o la foto
 * stessa, ridotte, da mostrare nella scheda al posto del file intero.
 *
 * Nasce per un motivo di **banda**, non di estetica. L'anteprima si
 * costruisce dal contenuto vero, quindi finora aprire la scheda di una
 * scansione da 15 MB ne riscaricava 15 MB --- ogni volta, perché niente
 * resta sul dispositivo (v. lib/storage/documents-bucket.ts: il file
 * vive cifrato nello Storage, non qui). E il traffico costa circa
 * quattro volte, al gigabyte, quanto costa conservare quello stesso
 * gigabyte per un mese: un archivio sfogliato spesso costava più in
 * banda che in spazio.
 *
 * Una miniatura pesa qualche decina di kilobyte: due ordini di
 * grandezza in meno, e la scheda si apre all'istante.
 *
 * Viene cifrata come qualunque altro contenuto prima di lasciare il
 * dispositivo --- è un pezzo del documento a tutti gli effetti, e sul
 * server non deve essere più leggibile dell'originale.
 */

/**
 * Larghezza massima della miniatura.
 *
 * Serve a **riconoscere** un documento, non a leggerlo: per leggerlo c'è
 * "Scarica". Novecento pixel bastano a capire al volo quale foglio si ha
 * davanti, e su una foto di uno scontrino si legge pure.
 */
const MAX_THUMBNAIL_PX = 900;

/**
 * JPEG e non PNG: una pagina scansionata è una fotografia, e in PNG
 * peserebbe megabyte --- cioè esattamente il problema che la miniatura
 * esiste per risolvere.
 */
const THUMBNAIL_QUALITY = 0.72;

/** I tipi per cui una miniatura ha senso: qualcosa da guardare. */
export function canHaveThumbnail(mimeType: string): boolean {
  return mimeType === "application/pdf" || mimeType.startsWith("image/");
}

/**
 * La miniatura di questo contenuto, o null se non se ne può fare una.
 *
 * **Non lancia mai**, come l'estrazione del testo (v.
 * domain/extraction/extract-text.ts): una miniatura è un di più, e un
 * file che non si riesce a disegnare non deve impedire di salvarlo.
 */
export async function createThumbnail(
  bytes: Uint8Array,
  mimeType: string,
): Promise<Blob | null> {
  try {
    if (mimeType === "application/pdf") {
      const rendered = await renderPdfFirstPage(bytes, MAX_THUMBNAIL_PX);
      return rendered?.image ?? null;
    }
    if (mimeType.startsWith("image/")) {
      return await shrinkImage(new Blob([bytes as BlobPart], { type: mimeType }));
    }
    return null;
  } catch (error) {
    console.warn("[thumbnail] impossibile creare la miniatura:", error);
    return null;
  }
}

async function shrinkImage(image: Blob): Promise<Blob | null> {
  // Sonda di capacità, come in pdf-extractor.ts: jsdom (i test unitari)
  // crea un canvas ma non sa disegnarci, e OffscreenCanvas è il modo
  // meno rumoroso di accorgersene.
  if (typeof document === "undefined" || typeof OffscreenCanvas === "undefined") return null;

  // `from-image`: le foto scattate col telefono portano l'orientamento
  // nei metadati EXIF invece che nei pixel. Senza, una foto verticale
  // diventerebbe una miniatura coricata.
  const bitmap = await createImageBitmap(image, { imageOrientation: "from-image" });
  try {
    const scale = Math.min(1, MAX_THUMBNAIL_PX / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context) return null;

    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    // Le immagini con trasparenza (PNG) su JPEG diventerebbero nere.
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

    const thumbnail = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", THUMBNAIL_QUALITY),
    );

    canvas.width = 0;
    canvas.height = 0;
    return thumbnail;
  } finally {
    bitmap.close();
  }
}
