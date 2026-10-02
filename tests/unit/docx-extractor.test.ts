import { describe, expect, it } from "vitest";
import { docxTextExtractor, DOCX_MIME_TYPE } from "@/domain/extraction/docx-extractor";
import { canExtractText, extractContent } from "@/domain/extraction/extract-text";
import { buildZip } from "./helpers/zip-builder";

const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
const para = (text: string) => `<w:p><w:r><w:t xml:space="preserve">${text}</w:t></w:r></w:p>`;
const doc = (body: string) => `<?xml version="1.0" encoding="UTF-8"?><w:document ${W}><w:body>${body}</w:body></w:document>`;

function docx(body: string, extra: { name: string; content: string }[] = []) {
  return buildZip([{ name: "word/document.xml", content: doc(body) }, ...extra]);
}

describe("docxTextExtractor", () => {
  it("riconosce solo il tipo MIME dei file Word", () => {
    expect(canExtractText(DOCX_MIME_TYPE)).toBe(true);
    expect(canExtractText("application/msword")).toBe(false);
  });

  it("legge i paragrafi nell'ordine, senza segmenti per pagina", async () => {
    const content = await docxTextExtractor.extractContent(
      docx(para("Contratto di locazione") + para("Valido fino al 3 giugno 2027.")),
      DOCX_MIME_TYPE,
    );
    expect(content.text).toBe("Contratto di locazione\nValido fino al 3 giugno 2027.");
    expect(content.segments).toEqual([]);
    expect(content.extraction).toMatchObject({ extractor: "docx-xml", ocr: false });
    expect(content.technical.mimeType).toBe(DOCX_MIME_TYPE);
  });

  it("unisce i pezzi di un paragrafo, tabulazioni e a capo compresi", async () => {
    const body = `<w:p><w:r><w:t>Numero</w:t></w:r><w:r><w:tab/></w:r><w:r><w:t>IT-4471</w:t></w:r><w:r><w:br/></w:r><w:r><w:t>riga</w:t></w:r></w:p>`;
    const content = await docxTextExtractor.extractContent(docx(body), DOCX_MIME_TYPE);
    expect(content.text).toBe("Numero IT-4471\nriga");
  });

  it("legge le tabelle una riga alla volta, con le celle separate", async () => {
    const cell = (text: string) => `<w:tc>${para(text)}</w:tc>`;
    const table = `<w:tbl><w:tr>${cell("Premio")}${cell("480,00 euro")}</w:tr><w:tr>${cell("Massimale")}${cell("1.000.000 euro")}</w:tr></w:tbl>`;
    const content = await docxTextExtractor.extractContent(docx(table), DOCX_MIME_TYPE);
    expect(content.text).toBe("Premio | 480,00 euro\nMassimale | 1.000.000 euro");
  });

  it("ignora il testo cancellato e i codici dei campi", async () => {
    const body = `<w:p><w:r><w:t>Resta</w:t></w:r><w:del><w:r><w:delText>Cancellato</w:delText></w:r></w:del><w:r><w:instrText>PAGE</w:instrText></w:r></w:p>`;
    const content = await docxTextExtractor.extractContent(docx(body), DOCX_MIME_TYPE);
    expect(content.text).toBe("Resta");
  });

  it("include intestazione e piè di pagina, una riga uguale una volta sola", async () => {
    const part = (text: string) => `<w:hdr ${W}>${para(text)}</w:hdr>`;
    const content = await docxTextExtractor.extractContent(
      docx(para("Corpo"), [
        { name: "word/header1.xml", content: part("GENERALI ITALIA S.p.A.") },
        { name: "word/header2.xml", content: part("GENERALI ITALIA S.p.A.") },
        { name: "word/footer1.xml", content: `<w:ftr ${W}>${para("Pagina riservata")}</w:ftr>` },
      ]),
      DOCX_MIME_TYPE,
    );
    expect(content.text).toBe("GENERALI ITALIA S.p.A.\nCorpo\nPagina riservata");
  });

  it("riporta titolo, autore e data di creazione dichiarati dal file", async () => {
    const core = `<cp:coreProperties xmlns:cp="a" xmlns:dc="b" xmlns:dcterms="c"><dc:title>Polizza</dc:title><dc:creator>Mario</dc:creator><dcterms:created>2026-03-14T09:30:00Z</dcterms:created></cp:coreProperties>`;
    const content = await docxTextExtractor.extractContent(
      docx(para("x"), [{ name: "docProps/core.xml", content: core }]),
      DOCX_MIME_TYPE,
    );
    expect(content.technical).toMatchObject({ title: "Polizza", author: "Mario", createdAt: "2026-03-14T09:30:00" });
  });

  it("legge anche le voci non compresse", async () => {
    const bytes = buildZip([{ name: "word/document.xml", content: doc(para("Senza compressione")), method: 0 }]);
    expect((await docxTextExtractor.extractContent(bytes, DOCX_MIME_TYPE)).text).toBe("Senza compressione");
  });

  it("un documento vuoto non ha testo", async () => {
    expect((await docxTextExtractor.extractContent(docx(""), DOCX_MIME_TYPE)).text).toBeNull();
  });

  it("lancia se il file non è uno ZIP o non contiene un documento Word", async () => {
    await expect(docxTextExtractor.extractContent(new Uint8Array([1, 2, 3]), DOCX_MIME_TYPE)).rejects.toThrow();
    await expect(
      docxTextExtractor.extractContent(buildZip([{ name: "altro.txt", content: "x" }]), DOCX_MIME_TYPE),
    ).rejects.toThrow(/documento Word/);
  });

  it("extractContent non lancia mai: un file rovinato dà null", async () => {
    expect(await extractContent(new Uint8Array([1, 2, 3]), DOCX_MIME_TYPE)).toBeNull();
  });
});
