/**
 * Contenuto per pagina, lingua e ispezione tecnica (Content Intelligence, PR1). Il PDF è vero e costruito a mano,
 * come in pdf-extractor.test.ts: è l'unico modo di sapere che pdf.js viene letto pagina per pagina come si deve.
 */
import { pathToFileURL } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import { buildExtractedContent } from "@/domain/extraction/content";
import { extractContent } from "@/domain/extraction/extract-text";
import { detectLanguage } from "@/domain/extraction/language";
import { inspectImage, parsePdfDate } from "@/domain/extraction/technical";
import { cleanExtractedText, MAX_EXTRACTED_CHARS } from "@/domain/extraction/types";

beforeAll(async () => {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc = pathToFileURL(
    require.resolve("pdfjs-dist/legacy/build/pdf.worker.mjs"),
  ).href;
});

function escapePdf(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

/** PDF valido con una pagina per elemento di `pages` (stringa vuota = pagina senza testo) e, a richiesta, il dizionario Info. */
function buildPdf(pages: string[], info?: Record<string, string>): Uint8Array {
  const pageCount = pages.length;
  const fontId = 3 + pageCount * 2;
  const infoId = fontId + 1;

  const objects: string[] = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    `<< /Type /Pages /Kids [${pages.map((_, i) => `${3 + i * 2} 0 R`).join(" ")}] /Count ${pageCount} >>`,
  ];
  pages.forEach((text, i) => {
    const stream = text ? `BT /F1 12 Tf 72 720 Td (${escapePdf(text)}) Tj ET` : "";
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents ${4 + i * 2} 0 R /Resources << /Font << /F1 ${fontId} 0 R >> >> >>`,
      `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    );
  });
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  if (info) {
    objects.push(`<< ${Object.entries(info).map(([key, value]) => `/${key} (${escapePdf(value)})`).join(" ")} >>`);
  }

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((body, i) => {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });

  const xrefStart = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R${info ? ` /Info ${infoId} 0 R` : ""} >>\nstartxref\n${xrefStart}\n%%EOF\n`;

  return new TextEncoder().encode(pdf);
}

const PAGE_ONE = "Polizza responsabilita civile scadenza 3 giugno 2027";
const PAGE_THREE = "Massimale per sinistro cinquecentomila euro";

describe("contenuto per pagina di un PDF", () => {
  it("dà un segmento per pagina con il numero reale, saltando le pagine vuote", async () => {
    const content = await extractContent(buildPdf([PAGE_ONE, "", PAGE_THREE]), "application/pdf");

    expect(content).not.toBeNull();
    expect(content!.segments.map((s) => [s.id, s.kind, s.kind === "page" ? s.index : null])).toEqual([
      ["p1", "page", 1],
      ["p3", "page", 3],
    ]);
    expect(content!.segments[0].text).toContain("3 giugno 2027");
    expect(content!.segments[1].text).toContain("Massimale");
  }, 30_000);

  it("tiene `text` uguale a prima: le pagine unite da una riga vuota", async () => {
    const pdf = buildPdf([PAGE_ONE, PAGE_THREE]);

    const content = await extractContent(pdf, "application/pdf");
    const text = (await extractContent(pdf, "application/pdf"))?.text ?? null;

    expect(text).toBe(content!.text);
    expect(text).toBe(`${PAGE_ONE}\n\n${PAGE_THREE}`);
  }, 30_000);

  it("registra ispezione tecnica ed estrattore", async () => {
    const pdf = buildPdf([PAGE_ONE, PAGE_THREE], {
      Title: "Polizza RC",
      Author: "Mario Rossi",
      Producer: "Generatore di prova",
      CreationDate: "D:20260314093000+01'00'",
    });

    const content = await extractContent(pdf, "application/pdf");

    expect(content!.technical).toMatchObject({
      mimeType: "application/pdf",
      sizeBytes: pdf.byteLength,
      pageCount: 2,
      pagesRead: 2,
      title: "Polizza RC",
      author: "Mario Rossi",
      producer: "Generatore di prova",
      createdAt: "2026-03-14T09:30:00+01:00",
    });
    expect(content!.extraction).toMatchObject({ extractor: "pdfjs", ocr: false });
    expect(content!.extraction.version).toMatch(/^pdfjs-/);
  }, 30_000);

  it("senza dizionario Info non inventa metadati", async () => {
    const content = await extractContent(buildPdf([PAGE_ONE]), "application/pdf");

    expect(content!.technical.pageCount).toBe(1);
    expect(content!.technical).not.toHaveProperty("title");
    expect(content!.technical).not.toHaveProperty("createdAt");
  }, 30_000);

  it("su un PDF senza testo dà contenuto vuoto, non un errore", async () => {
    const content = await extractContent(buildPdf(["", ""]), "application/pdf");

    expect(content).not.toBeNull();
    expect(content!.text).toBeNull();
    expect(content!.segments).toEqual([]);
    expect(content!.language).toBeNull();
    expect(content!.technical.pageCount).toBe(2);
  }, 30_000);

  it("restituisce null su un file che non è un PDF e sui tipi senza motore", async () => {
    await expect(extractContent(new TextEncoder().encode("non è un PDF"), "application/pdf")).resolves.toBeNull();
    await expect(extractContent(new Uint8Array([1, 2, 3]), "audio/webm")).resolves.toBeNull();
  }, 30_000);
});

describe("buildExtractedContent", () => {
  const technical = { mimeType: "application/pdf", sizeBytes: 1 };
  const extraction = { extractor: "test", version: "1", ocr: false };

  it("taglia `text` al tetto della ricerca ma non i segmenti", () => {
    const huge = "parola ".repeat(MAX_EXTRACTED_CHARS / 3);
    const content = buildExtractedContent({ pages: [{ index: 1, text: huge }], technical, extraction });

    expect(content.text).toHaveLength(MAX_EXTRACTED_CHARS);
    expect(content.segments[0].text.length).toBeGreaterThan(MAX_EXTRACTED_CHARS);
  });

  it("scarta le pagine che puliscono a vuoto", () => {
    const content = buildExtractedContent({
      pages: [{ index: 1, text: "  \n \n " }, { index: 2, text: "ciao" }],
      technical,
      extraction,
    });

    expect(content.segments.map((s) => s.id)).toEqual(["p2"]);
    expect(content.text).toBe("ciao");
  });

  it("senza pagine non c'è testo né lingua", () => {
    const content = buildExtractedContent({ pages: [], technical, extraction });

    expect(content).toMatchObject({ text: null, language: null, segments: [] });
  });
});

describe("cleanExtractedText", () => {
  it("ripulisce ma non taglia", () => {
    expect(cleanExtractedText("  a  b \r\n\r\n\r\n\r\nc ")).toBe("a b\n\nc");
    expect(cleanExtractedText("x".repeat(MAX_EXTRACTED_CHARS + 10))).toHaveLength(MAX_EXTRACTED_CHARS + 10);
  });
});

describe("detectLanguage", () => {
  it("riconosce le lingue più comuni", () => {
    expect(detectLanguage("Il presente contratto è stato stipulato tra le parti per la fornitura di energia elettrica e gas.")).toBe("it");
    expect(detectLanguage("This agreement is made between the parties for the supply of goods and services that are described in the schedule.")).toBe("en");
    expect(detectLanguage("Le présent contrat est conclu entre les parties pour la fourniture de biens et de services dans le cadre de la loi.")).toBe("fr");
  });

  it("non azzarda su testi brevi o senza parole riconoscibili", () => {
    expect(detectLanguage("Polizza 2027")).toBeNull();
    expect(detectLanguage("xkcd qwerty zzz plugh xyzzy foo bar baz quux corge grault garply waldo fred")).toBeNull();
  });
});

describe("parsePdfDate", () => {
  it("converte in ISO 8601", () => {
    expect(parsePdfDate("D:20260314093000+01'00'")).toBe("2026-03-14T09:30:00+01:00");
    expect(parsePdfDate("D:20260314093000Z")).toBe("2026-03-14T09:30:00Z");
    expect(parsePdfDate("D:20260314")).toBe("2026-03-14");
  });

  it("dà null se non è nel formato", () => {
    expect(parsePdfDate("ieri")).toBeNull();
  });
});

describe("inspectImage", () => {
  const u16 = (n: number) => [n & 0xff, (n >> 8) & 0xff];
  const u32 = (n: number) => [n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, (n >> 24) & 0xff];
  const be16 = (n: number) => [(n >> 8) & 0xff, n & 0xff];
  const ascii = (s: string) => Array.from(s, (c) => c.charCodeAt(0));

  function png(width: number, height: number): Uint8Array {
    const be32 = (n: number) => [(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff];
    return new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...be32(13), ...ascii("IHDR"), ...be32(width), ...be32(height)]);
  }

  /** JPEG minimo con EXIF little-endian: marca, modello, data di scatto e un puntatore GPS (le coordinate non esistono nemmeno). */
  function jpeg(withGps: boolean): Uint8Array {
    const make = [...ascii("Canon"), 0];
    const model = [...ascii("EOS R"), 0];
    const date = [...ascii("2026:03:14 09:30:00"), 0];

    const entries: number[][] = [
      [...u16(0x010f), ...u16(2), ...u32(make.length), ...u32(0)],
      [...u16(0x0110), ...u16(2), ...u32(model.length), ...u32(0)],
      [...u16(0x0132), ...u16(2), ...u32(date.length), ...u32(0)],
    ];
    if (withGps) entries.push([...u16(0x8825), ...u16(4), ...u32(1), ...u32(200)]);

    const dataStart = 8 + 2 + entries.length * 12 + 4;
    entries[0].splice(8, 4, ...u32(dataStart));
    entries[1].splice(8, 4, ...u32(dataStart + make.length));
    entries[2].splice(8, 4, ...u32(dataStart + make.length + model.length));

    const tiff = [...ascii("II"), ...u16(42), ...u32(8), ...u16(entries.length), ...entries.flat(), ...u32(0), ...make, ...model, ...date];
    const exif = [...ascii("Exif"), 0, 0, ...tiff];

    return new Uint8Array([
      0xff, 0xd8,
      0xff, 0xe1, ...be16(exif.length + 2), ...exif,
      0xff, 0xc0, ...be16(11), 8, ...be16(3000), ...be16(4000), 1, 1, 0x11, 0,
      0xff, 0xd9,
    ]);
  }

  it("legge le dimensioni di un PNG", () => {
    expect(inspectImage(png(640, 480), "image/png")).toEqual({
      mimeType: "image/png",
      sizeBytes: 24,
      width: 640,
      height: 480,
    });
  });

  it("legge dimensioni ed EXIF di un JPEG", () => {
    const technical = inspectImage(jpeg(false), "image/jpeg");

    expect(technical).toMatchObject({
      width: 4000,
      height: 3000,
      cameraMake: "Canon",
      cameraModel: "EOS R",
      createdAt: "2026-03-14T09:30:00",
    });
    expect(technical).not.toHaveProperty("hasGpsLocation");
  });

  it("registra solo che la posizione GPS c'è, mai le coordinate", () => {
    const technical = inspectImage(jpeg(true), "image/jpeg");

    expect(technical.hasGpsLocation).toBe(true);
    expect(Object.keys(technical)).not.toContain("latitude");
    expect(Object.keys(technical)).not.toContain("longitude");
  });

  it("non lancia su byte malformati", () => {
    expect(inspectImage(new Uint8Array([0xff, 0xd8, 0xff, 0xe1, 0xff, 0xff]), "image/jpeg")).toMatchObject({ sizeBytes: 6 });
    expect(inspectImage(new Uint8Array([1, 2, 3]), "image/png")).toEqual({ mimeType: "image/png", sizeBytes: 3 });
  });
});
