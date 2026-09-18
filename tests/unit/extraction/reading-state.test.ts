/**
 * FASE 17e --- i quattro stati in cui può stare il rapporto tra Hinthial
 * e il contenuto di un file. Prima della pagina di dettaglio erano
 * indistinguibili dal di fuori (in tre casi su quattro il testo estratto
 * risulta vuoto), e la scheda del contenuto li racconta uno per uno: se
 * questa funzione sbaglia, la pagina dice all'utente una cosa falsa sul
 * proprio archivio.
 */
import { describe, expect, it } from "vitest";
import { readingStateFor } from "@/domain/extraction/reading-state";
import { NOTE_MIME_TYPE } from "@/lib/content-kind";

function doc(over: Partial<Parameters<typeof readingStateFor>[0]>) {
  return {
    mimeType: "application/pdf",
    extractedText: "",
    extractedAt: null,
    ...over,
  };
}

describe("lo stato di lettura di un contenuto", () => {
  it("una nota è testo di suo: non c'è niente da estrarre", () => {
    expect(readingStateFor(doc({ mimeType: NOTE_MIME_TYPE }))).toBe("own-text");
  });

  it("un audio non lo sa ancora leggere", () => {
    expect(readingStateFor(doc({ mimeType: "audio/webm" }))).toBe("cannot");
    expect(readingStateFor(doc({ mimeType: "video/mp4" }))).toBe("cannot");
  });

  it("un PDF mai guardato è 'mai letto', non 'letto a vuoto'", () => {
    // È la distinzione introdotta con `extracted_at` nella FASE 17b:
    // senza, un documento caricato prima dell'estrazione sembrerebbe uno
    // che è stato letto e non conteneva nulla.
    expect(readingStateFor(doc({ extractedAt: null, extractedText: "" }))).toBe("never");
  });

  it("un PDF guardato senza trovare testo è 'letto a vuoto'", () => {
    expect(readingStateFor(doc({ extractedAt: "2026-09-18T10:00:00Z", extractedText: "" }))).toBe(
      "nothing",
    );
  });

  it("del testo fatto di soli spazi non conta come testo trovato", () => {
    expect(
      readingStateFor(doc({ extractedAt: "2026-09-18T10:00:00Z", extractedText: "   \n  " })),
    ).toBe("nothing");
  });

  it("un PDF con del testo è 'letto'", () => {
    expect(
      readingStateFor(doc({ extractedAt: "2026-09-18T10:00:00Z", extractedText: "Referto" })),
    ).toBe("text");
  });

  it("un'immagine segue le stesse regole: l'OCR la sa leggere", () => {
    expect(readingStateFor(doc({ mimeType: "image/jpeg" }))).toBe("never");
    expect(
      readingStateFor(
        doc({ mimeType: "image/jpeg", extractedAt: "2026-09-18T10:00:00Z", extractedText: "Ricevuta" }),
      ),
    ).toBe("text");
  });
});
