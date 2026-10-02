/**
 * Lettura minima di un archivio ZIP (il contenitore di DOCX, XLSX, PPTX), sul dispositivo e senza dipendenze: l'indice
 * in fondo al file dice dove sta ogni voce, e il contenuto compresso si apre con `DecompressionStream`, che i browser
 * hanno già. Niente ZIP64, niente cifratura: un documento che li usa non si legge, e chi chiama lo tratta come "nessun
 * contenuto".
 */

const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_SIGNATURE = 0x02014b50;
const LOCAL_SIGNATURE = 0x04034b50;
const MAX_COMMENT_LENGTH = 0xffff;

export interface ZipEntry {
  name: string;
  method: number;
  compressedSize: number;
  uncompressedSize: number;
  localHeaderOffset: number;
}

export class ZipError extends Error {}

function viewOf(bytes: Uint8Array): DataView {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
}

/** Le voci dell'archivio, lette dall'indice centrale. Lancia ZipError se il file non è uno ZIP leggibile. */
export function listZipEntries(bytes: Uint8Array): ZipEntry[] {
  const view = viewOf(bytes);
  const earliest = Math.max(0, bytes.length - 22 - MAX_COMMENT_LENGTH);
  let eocd = -1;
  for (let at = bytes.length - 22; at >= earliest; at--) {
    if (view.getUint32(at, true) === EOCD_SIGNATURE) {
      eocd = at;
      break;
    }
  }
  if (eocd < 0) throw new ZipError("Non è un archivio ZIP.");

  const count = view.getUint16(eocd + 10, true);
  let offset = view.getUint32(eocd + 16, true);
  if (count === 0xffff || offset === 0xffffffff) throw new ZipError("Gli archivi ZIP64 non sono supportati.");

  const decoder = new TextDecoder();
  const entries: ZipEntry[] = [];
  for (let i = 0; i < count; i++) {
    if (offset + 46 > bytes.length || view.getUint32(offset, true) !== CENTRAL_SIGNATURE) {
      throw new ZipError("Indice dell'archivio danneggiato.");
    }
    const flags = view.getUint16(offset + 8, true);
    if (flags & 1) throw new ZipError("L'archivio è cifrato.");
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    entries.push({
      method: view.getUint16(offset + 10, true),
      compressedSize: view.getUint32(offset + 20, true),
      uncompressedSize: view.getUint32(offset + 24, true),
      localHeaderOffset: view.getUint32(offset + 42, true),
      name: decoder.decode(bytes.subarray(offset + 46, offset + 46 + nameLength)),
    });
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

async function inflateRaw(data: Uint8Array, maxBytes: number): Promise<Uint8Array> {
  // ReadableStream e non Blob.stream(): l'ambiente di prova (jsdom) non ha quest'ultimo.
  const source = new ReadableStream<Uint8Array<ArrayBuffer>>({
    start(controller) {
      controller.enqueue(data as Uint8Array<ArrayBuffer>);
      controller.close();
    },
  });
  const stream = source.pipeThrough(new DecompressionStream("deflate-raw"));
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    // L'intestazione può mentire sulla dimensione: il tetto si controlla su ciò che esce davvero.
    if (total > maxBytes) {
      await reader.cancel();
      throw new ZipError("La voce è troppo grande.");
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let at = 0;
  for (const chunk of chunks) {
    out.set(chunk, at);
    at += chunk.length;
  }
  return out;
}

/** Il contenuto di una voce, aperto. `maxBytes` ferma un archivio costruito per esplodere in memoria. */
export async function readZipEntry(bytes: Uint8Array, entry: ZipEntry, maxBytes: number): Promise<Uint8Array> {
  if (entry.uncompressedSize > maxBytes) throw new ZipError("La voce è troppo grande.");
  const view = viewOf(bytes);
  const at = entry.localHeaderOffset;
  if (at + 30 > bytes.length || view.getUint32(at, true) !== LOCAL_SIGNATURE) {
    throw new ZipError("Voce dell'archivio danneggiata.");
  }
  const start = at + 30 + view.getUint16(at + 26, true) + view.getUint16(at + 28, true);
  const end = start + entry.compressedSize;
  if (end > bytes.length) throw new ZipError("Voce dell'archivio troncata.");
  const data = bytes.subarray(start, end);

  if (entry.method === 0) return data;
  if (entry.method === 8) return inflateRaw(data, maxBytes);
  throw new ZipError(`Compressione ${entry.method} non supportata.`);
}
