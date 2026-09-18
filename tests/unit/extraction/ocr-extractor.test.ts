/**
 * FASE 17c --- l'OCR vero gira in un Web Worker con qualche megabyte di
 * WebAssembly: non è esercitabile in jsdom, e viene provato end-to-end
 * su un'immagine vera (v. tests/e2e/archive-ocr-image.spec.ts).
 *
 * Qui si verifica ciò che si può verificare da solo, e che è anche la
 * parte in cui è più facile sbagliarsi: quali file l'OCR accetta, e il
 * filtro che decide se quello che ha letto è testo o spazzatura. Il
 * filtro conta più del motore --- un OCR non dice mai "non ho trovato
 * niente", e senza di lui la ricerca si riempirebbe di documenti che
 * "contengono" parole che nessuno ci ha mai scritto.
 */
import { describe, expect, it } from "vitest";
import { canExtractText } from "@/domain/extraction/extract-text";
import { looksLikeRealText, ocrTextExtractor } from "@/domain/extraction/ocr-extractor";

describe("quali contenuti l'OCR accetta", () => {
  it.each(["image/jpeg", "image/png", "image/webp", "image/bmp", "image/gif"])(
    "legge %s",
    (mimeType) => {
      expect(ocrTextExtractor.supports(mimeType)).toBe(true);
      // E il registro dei motori deve saperlo, altrimenti il documento
      // verrebbe salvato senza nemmeno provare (v. extract-text.ts).
      expect(canExtractText(mimeType)).toBe(true);
    },
  );

  it("non accetta un HEIC: nessun browser lo sa decodificare", () => {
    expect(ocrTextExtractor.supports("image/heic")).toBe(false);
  });

  it("non accetta ciò che non è un'immagine", () => {
    expect(ocrTextExtractor.supports("audio/webm")).toBe(false);
    expect(ocrTextExtractor.supports("text/plain")).toBe(false);
  });

  it("lascia il PDF al suo motore, che lo legge meglio", () => {
    expect(ocrTextExtractor.supports("application/pdf")).toBe(false);
  });
});

describe("il filtro contro la spazzatura dell'OCR", () => {
  it("tiene un referto letto con confidenza alta", () => {
    expect(looksLikeRealText("Referto di risonanza magnetica del 14 marzo 2026", 93)).toBe(true);
  });

  it("scarta una lettura con confidenza bassa, per quanto lunga", () => {
    expect(looksLikeRealText("Referto di risonanza magnetica del 14 marzo 2026", 20)).toBe(false);
  });

  it("scarta i simboli slegati di una foto senza testo", () => {
    // È ciò che l'OCR restituisce davanti a un muro o a una firma:
    // confidenza anche alta, ma nessuna parola vera.
    expect(looksLikeRealText("| . -- ' ~", 90)).toBe(false);
  });

  it("scarta due sole parole: troppo poco per essere un documento", () => {
    expect(looksLikeRealText("Ada Lovelace", 95)).toBe(false);
  });

  it("tiene tre parole vere: un timbro o un'intestazione contano", () => {
    expect(looksLikeRealText("Poliambulatorio Sassoferrato Ancona", 95)).toBe(true);
  });

  it("non conta come parole le sigle di una o due lettere", () => {
    expect(looksLikeRealText("a b c d e f", 95)).toBe(false);
  });

  it("conta i numeri: una data e un importo sono contenuto", () => {
    expect(looksLikeRealText("2026 1450 0012", 95)).toBe(true);
  });
});
