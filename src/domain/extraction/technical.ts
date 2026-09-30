import type { TechnicalMetadata } from "@/domain/extraction/types";

/**
 * Ispezione tecnica del file, tutta sul dispositivo: formato, dimensioni, e ciò che il file dichiara di sé (EXIF delle
 * foto, dizionario Info dei PDF). Sono dichiarazioni, non verità: una data EXIF può essere sbagliata o modificata.
 * La posizione GPS non viene mai letta --- si registra solo che c'è.
 */

/** Il minimo per ogni file, qualunque sia il tipo. */
export function baseTechnicalMetadata(bytes: Uint8Array, mimeType: string): TechnicalMetadata {
  return { mimeType, sizeBytes: bytes.byteLength };
}

/** Dimensioni ed EXIF di un'immagine, dove il formato lo permette; il resto resta non valorizzato. Non lancia mai su byte malformati. */
export function inspectImage(bytes: Uint8Array, mimeType: string): TechnicalMetadata {
  const technical = baseTechnicalMetadata(bytes, mimeType);
  try {
    if (isPng(bytes)) Object.assign(technical, readPngSize(bytes));
    else if (isJpeg(bytes)) Object.assign(technical, readJpeg(bytes));
    else if (isGif(bytes)) Object.assign(technical, readGifSize(bytes));
    else if (isBmp(bytes)) Object.assign(technical, readBmpSize(bytes));
    else if (isWebp(bytes)) Object.assign(technical, readWebpSize(bytes));
  } catch {
    // Byte troncati o fuori formato: l'ispezione è un di più, si tiene ciò che si è già letto.
  }
  return technical;
}

/** Data di creazione di un PDF (`D:20260314093000+01'00'`) in ISO 8601; null se non è nel formato. */
export function parsePdfDate(raw: string): string | null {
  const match = /^D:(\d{4})(\d{2})?(\d{2})?(\d{2})?(\d{2})?(\d{2})?(Z|[+-]\d{2}'?(?:\d{2}'?)?)?/.exec(raw.trim());
  if (!match) return null;

  const [, year, month = "01", day = "01", hour, minute = "00", second = "00", zone] = match;
  if (hour === undefined) return `${year}-${month}-${day}`;

  let offset = "";
  if (zone === "Z") offset = "Z";
  else if (zone) {
    const digits = zone.replace(/'/g, "");
    offset = `${digits.slice(0, 3)}:${digits.slice(3, 5) || "00"}`;
  }
  return `${year}-${month}-${day}T${hour}:${minute}:${second}${offset}`;
}

function isPng(b: Uint8Array): boolean {
  return b.length >= 24 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47;
}
function isJpeg(b: Uint8Array): boolean {
  return b.length >= 4 && b[0] === 0xff && b[1] === 0xd8;
}
function isGif(b: Uint8Array): boolean {
  return b.length >= 10 && b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38;
}
function isBmp(b: Uint8Array): boolean {
  return b.length >= 26 && b[0] === 0x42 && b[1] === 0x4d;
}
function isWebp(b: Uint8Array): boolean {
  return b.length >= 30 && ascii(b, 0, 4) === "RIFF" && ascii(b, 8, 12) === "WEBP";
}

function ascii(b: Uint8Array, from: number, to: number): string {
  return String.fromCharCode(...b.subarray(from, to));
}

function viewOf(b: Uint8Array): DataView {
  return new DataView(b.buffer, b.byteOffset, b.byteLength);
}

function readPngSize(b: Uint8Array): Pick<TechnicalMetadata, "width" | "height"> {
  const view = viewOf(b);
  return { width: view.getUint32(16), height: view.getUint32(20) };
}

function readGifSize(b: Uint8Array): Pick<TechnicalMetadata, "width" | "height"> {
  const view = viewOf(b);
  return { width: view.getUint16(6, true), height: view.getUint16(8, true) };
}

function readBmpSize(b: Uint8Array): Pick<TechnicalMetadata, "width" | "height"> {
  const view = viewOf(b);
  return { width: Math.abs(view.getInt32(18, true)), height: Math.abs(view.getInt32(22, true)) };
}

/** Solo il formato esteso (VP8X): le altre varianti WebP dicono le dimensioni in un bitstream da decodificare, non vale la pena. */
function readWebpSize(b: Uint8Array): Pick<TechnicalMetadata, "width" | "height"> {
  if (ascii(b, 12, 16) !== "VP8X") return {};
  return {
    width: 1 + (b[24] | (b[25] << 8) | (b[26] << 16)),
    height: 1 + (b[27] | (b[28] << 8) | (b[29] << 16)),
  };
}

/** Marcatori JPEG "Start Of Frame" (con le dimensioni): C0-CF tranne DHT (C4), JPG (C8) e DAC (CC). */
function isStartOfFrame(marker: number): boolean {
  return marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
}

function readJpeg(b: Uint8Array): Partial<TechnicalMetadata> {
  const view = viewOf(b);
  const result: Partial<TechnicalMetadata> = {};

  let offset = 2;
  while (offset + 4 <= b.length) {
    if (b[offset] !== 0xff) break;
    const marker = b[offset + 1];
    // Marcatori senza lunghezza (riempimento, RSTn, SOI).
    if (marker === 0xff) {
      offset += 1;
      continue;
    }
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8)) {
      offset += 2;
      continue;
    }
    if (marker === 0xd9 || marker === 0xda) break;

    const length = view.getUint16(offset + 2);
    if (isStartOfFrame(marker) && offset + 9 <= b.length) {
      result.height = view.getUint16(offset + 5);
      result.width = view.getUint16(offset + 7);
    } else if (marker === 0xe1 && ascii(b, offset + 4, offset + 10) === "Exif\0\0") {
      Object.assign(result, readExif(b.subarray(offset + 10, offset + 2 + length)));
    }
    offset += 2 + length;
  }
  return result;
}

const TAG_MAKE = 0x010f;
const TAG_MODEL = 0x0110;
const TAG_DATETIME = 0x0132;
const TAG_EXIF_IFD = 0x8769;
const TAG_GPS_IFD = 0x8825;
const TAG_DATETIME_ORIGINAL = 0x9003;

interface ExifEntry {
  type: number;
  count: number;
  valueAt: number;
}

/** Legge solo i tag che servono (marca, modello, data di scatto, presenza del GPS). `tiff` inizia dall'intestazione TIFF. */
function readExif(tiff: Uint8Array): Partial<TechnicalMetadata> {
  if (tiff.length < 8) return {};
  const view = viewOf(tiff);
  const order = ascii(tiff, 0, 2);
  if (order !== "II" && order !== "MM") return {};
  const little = order === "II";

  const readIfd = (ifdOffset: number): Map<number, ExifEntry> => {
    const entries = new Map<number, ExifEntry>();
    if (ifdOffset + 2 > tiff.length) return entries;
    const count = view.getUint16(ifdOffset, little);
    for (let i = 0; i < count; i++) {
      const at = ifdOffset + 2 + i * 12;
      if (at + 12 > tiff.length) break;
      const type = view.getUint16(at + 2, little);
      const valueCount = view.getUint32(at + 4, little);
      // Un valore di più di 4 byte sta altrove, e il campo contiene il suo indirizzo.
      const size = type === 2 ? valueCount : 4;
      const valueAt = size > 4 ? view.getUint32(at + 8, little) : at + 8;
      entries.set(view.getUint16(at, little), { type, count: valueCount, valueAt });
    }
    return entries;
  };

  const readText = (entry?: ExifEntry): string | undefined => {
    if (!entry || entry.type !== 2 || entry.valueAt + entry.count > tiff.length) return undefined;
    const text = ascii(tiff, entry.valueAt, entry.valueAt + entry.count).split("\0")[0].trim();
    return text || undefined;
  };

  const result: Partial<TechnicalMetadata> = {};
  const ifd0 = readIfd(view.getUint32(4, little));
  result.cameraMake = readText(ifd0.get(TAG_MAKE));
  result.cameraModel = readText(ifd0.get(TAG_MODEL));

  let capturedAt: string | undefined;
  const exifPointer = ifd0.get(TAG_EXIF_IFD);
  if (exifPointer) {
    const exifIfd = readIfd(view.getUint32(exifPointer.valueAt, little));
    capturedAt = readText(exifIfd.get(TAG_DATETIME_ORIGINAL));
  }
  capturedAt ??= readText(ifd0.get(TAG_DATETIME));
  const match = capturedAt ? /^(\d{4}):(\d{2}):(\d{2}) (\d{2}:\d{2}:\d{2})$/.exec(capturedAt) : null;
  if (match) result.createdAt = `${match[1]}-${match[2]}-${match[3]}T${match[4]}`;

  if (ifd0.has(TAG_GPS_IFD)) result.hasGpsLocation = true;

  // Non si restituiscono chiavi non valorizzate.
  return Object.fromEntries(Object.entries(result).filter(([, value]) => value !== undefined));
}
