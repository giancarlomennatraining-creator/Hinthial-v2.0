/**
 * FASE 17 --- l'estrazione del testo da un PDF, verificata su un PDF
 * vero costruito qui (non un mock del motore): è l'unico modo di sapere
 * se pdf.js viene invocato come si deve e se il testo torna leggibile.
 *
 * Il PDF è scritto a mano in byte perché basta un file minimo e valido:
 * una pagina, un font standard, una stringa. Una libreria per generarlo
 * sarebbe una dipendenza in più per un unico test.
 */
import { pathToFileURL } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import { extractText, canExtractText } from "@/domain/extraction/extract-text";
import { normalizeExtractedText, MAX_EXTRACTED_CHARS } from "@/domain/extraction/types";

// Qui i test girano in jsdom: `window` esiste, ma il loader ESM di Node
// accetta solo file:/data:, quindi l'URL che il bundler userebbe nel
// browser (http://) non è caricabile. Si indica il worker come file
// locale --- l'estrattore rispetta una configurazione già presente
// (v. domain/extraction/pdf-extractor.ts).
beforeAll(async () => {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc = pathToFileURL(
    require.resolve("pdfjs-dist/legacy/build/pdf.worker.mjs"),
  ).href;
});

/** PDF minimo valido con una riga di testo, costruito a mano. */
function buildPdf(text: string): Uint8Array {
  const escaped = text.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
  const stream = `BT /F1 12 Tf 72 720 Td (${escaped}) Tj ET`;

  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((body, i) => {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });

  const xrefStart = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`;

  return new TextEncoder().encode(pdf);
}

describe("estrazione testo (FASE 17)", () => {
  it("riconosce i tipi che sa leggere", () => {
    expect(canExtractText("application/pdf")).toBe(true);
    expect(canExtractText("image/jpeg")).toBe(false);
    expect(canExtractText("audio/webm")).toBe(false);
  });

  it("legge il testo dentro un PDF vero", async () => {
    const pdf = buildPdf("Polizza responsabilita civile scadenza 3 giugno 2027");

    const text = await extractText(pdf, "application/pdf");

    expect(text).toContain("Polizza");
    expect(text).toContain("3 giugno 2027");
  }, 30_000);

  it("non tocca i byte ricevuti --- servono ancora per cifrare il file", async () => {
    const pdf = buildPdf("contenuto di prova");
    const copy = new Uint8Array(pdf);

    await extractText(pdf, "application/pdf");

    // pdf.js prende possesso del buffer che riceve: se non gliene
    // passassimo una copia, qui i byte risulterebbero svuotati e il
    // documento verrebbe salvato vuoto.
    expect(pdf.byteLength).toBe(copy.byteLength);
    expect(Array.from(pdf.slice(0, 8))).toEqual(Array.from(copy.slice(0, 8)));
  }, 30_000);

  it("restituisce null invece di lanciare, su un file che non è un PDF", async () => {
    const notAPdf = new TextEncoder().encode("questo non è un PDF");

    await expect(extractText(notAPdf, "application/pdf")).resolves.toBeNull();
  }, 30_000);

  it("ignora i tipi senza un motore disponibile", async () => {
    await expect(extractText(new Uint8Array([1, 2, 3]), "image/png")).resolves.toBeNull();
  });

  it("normalizza gli spazi e taglia i testi enormi", () => {
    expect(normalizeExtractedText("  ciao   \n  mondo ")).toBe("ciao mondo");
    expect(normalizeExtractedText("   ")).toBeNull();
    expect(normalizeExtractedText("a".repeat(MAX_EXTRACTED_CHARS + 500))?.length).toBe(
      MAX_EXTRACTED_CHARS,
    );
  });
});
