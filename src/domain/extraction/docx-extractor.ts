import { detectLanguage } from "@/domain/extraction/language";
import { baseTechnicalMetadata } from "@/domain/extraction/technical";
import {
  cleanExtractedText,
  normalizeExtractedText,
  type ExtractedContent,
  type TechnicalMetadata,
  type TextExtractor,
} from "@/domain/extraction/types";
import { listZipEntries, readZipEntry, type ZipEntry } from "@/lib/zip";

/**
 * Legge il testo di un documento Word (.docx) sul dispositivo, senza librerie: un DOCX è uno ZIP di XML, e il testo sta
 * in `word/document.xml`. Un DOCX non ha pagine (le decide chi lo apre, in base a font e margini), quindi non ci sono
 * segmenti per pagina: l'analisi lavora per sezioni del testo e la provenienza dice "nel testo".
 */

export const DOCX_MIME_TYPE = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

/** Più di così, per una sola voce, non è un documento: è un archivio costruito per riempire la memoria. */
const MAX_PART_BYTES = 30 * 1024 * 1024;

const W_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
const MC_NS = "http://schemas.openxmlformats.org/markup-compatibility/2006";

function parseXml(bytes: Uint8Array): Document | null {
  const doc = new DOMParser().parseFromString(new TextDecoder().decode(bytes), "application/xml");
  return doc.getElementsByTagName("parsererror").length > 0 ? null : doc;
}

const isWord = (node: Element, name: string) => node.namespaceURI === W_NS && node.localName === name;

/** Il testo di un paragrafo, nell'ordine del documento. Solo `w:t`: il testo cancellato (`w:delText`) e i codici dei campi (`w:instrText`) non contano. */
function paragraphText(paragraph: Element): string {
  let text = "";
  const visit = (node: Element) => {
    for (const child of Array.from(node.children)) {
      // Una casella di testo compare due volte, nella versione moderna e in quella di ripiego: si legge una sola.
      if (child.namespaceURI === MC_NS && child.localName === "Fallback") continue;
      if (child.namespaceURI === W_NS) {
        if (child.localName === "t") text += child.textContent ?? "";
        else if (child.localName === "tab") text += "\t";
        else if (child.localName === "br" || child.localName === "cr") text += "\n";
        else if (child.localName === "noBreakHyphen") text += "-";
      }
      visit(child);
    }
  };
  visit(paragraph);
  return text;
}

/** Le righe di un contenitore (corpo, cella, intestazione): un paragrafo è una riga, una riga di tabella una sola riga con le celle separate da " | ". */
function linesOf(container: Element): string[] {
  const lines: string[] = [];
  for (const child of Array.from(container.children)) {
    if (isWord(child, "p")) {
      lines.push(paragraphText(child));
    } else if (isWord(child, "tbl")) {
      for (const row of Array.from(child.children).filter((node) => isWord(node, "tr"))) {
        const cells = Array.from(row.children)
          .filter((node) => isWord(node, "tc"))
          .map((cell) => linesOf(cell).join(" ").trim())
          .filter(Boolean);
        if (cells.length > 0) lines.push(cells.join(" | "));
      }
    } else if (isWord(child, "sdt")) {
      const content = Array.from(child.children).find((node) => isWord(node, "sdtContent"));
      if (content) lines.push(...linesOf(content));
    }
  }
  return lines;
}

function textOfPart(bytes: Uint8Array): string[] {
  const doc = parseXml(bytes);
  const root = doc?.documentElement;
  if (!root) return [];
  const body = Array.from(root.children).find((node) => isWord(node, "body"));
  return linesOf(body ?? root);
}

async function readPart(bytes: Uint8Array, entries: ZipEntry[], name: string): Promise<Uint8Array | null> {
  const entry = entries.find((candidate) => candidate.name === name);
  return entry ? readZipEntry(bytes, entry, MAX_PART_BYTES) : null;
}

/** Intestazioni o piè di pagina (`word/header1.xml`...): spesso portano l'emittente. Una riga uguale in più intestazioni conta una volta. */
async function readHeadersOrFooters(
  bytes: Uint8Array,
  entries: ZipEntry[],
  kind: "header" | "footer",
): Promise<string[]> {
  const names = entries
    .map((entry) => entry.name)
    .filter((name) => new RegExp(`^word/${kind}\\d*\\.xml$`).test(name))
    .sort();
  const seen = new Set<string>();
  const lines: string[] = [];
  for (const name of names) {
    const part = await readPart(bytes, entries, name);
    if (!part) continue;
    for (const line of textOfPart(part)) {
      const key = line.trim();
      if (key && !seen.has(key)) {
        seen.add(key);
        lines.push(line);
      }
    }
  }
  return lines;
}

/** Titolo, autore e data di creazione che il file dichiara di sé (`docProps/core.xml`). */
function readCoreProperties(bytes: Uint8Array | null, technical: TechnicalMetadata): void {
  const doc = bytes ? parseXml(bytes) : null;
  if (!doc) return;
  const valueOf = (localName: string) =>
    Array.from(doc.documentElement.children)
      .find((node) => node.localName === localName)
      ?.textContent?.trim();
  const title = valueOf("title");
  if (title) technical.title = title;
  const author = valueOf("creator");
  if (author) technical.author = author;
  const created = valueOf("created");
  if (created && /^\d{4}-\d{2}-\d{2}/.test(created)) technical.createdAt = created.replace(/Z$/, "");
}

export const docxTextExtractor: TextExtractor = {
  name: "Word (sul dispositivo)",

  supports(mimeType: string): boolean {
    return mimeType === DOCX_MIME_TYPE;
  },

  async extractContent(bytes: Uint8Array, mimeType: string): Promise<ExtractedContent> {
    const technical = baseTechnicalMetadata(bytes, mimeType);
    const entries = listZipEntries(bytes);

    const documentPart = await readPart(bytes, entries, "word/document.xml");
    if (!documentPart) throw new Error("Il file non contiene un documento Word.");

    readCoreProperties(await readPart(bytes, entries, "docProps/core.xml").catch(() => null), technical);

    const lines = [
      ...(await readHeadersOrFooters(bytes, entries, "header")),
      ...textOfPart(documentPart),
      ...(await readHeadersOrFooters(bytes, entries, "footer")),
    ];
    const text = normalizeExtractedText(cleanExtractedText(lines.join("\n")));

    return {
      text,
      language: text ? detectLanguage(text) : null,
      segments: [],
      technical,
      extraction: { extractor: "docx-xml", version: "docx-1", ocr: false },
    };
  },
};
