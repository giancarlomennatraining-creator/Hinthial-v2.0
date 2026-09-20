/**
 * La miniatura di un contenuto (v. lib/thumbnail.ts) --- nasce per un
 * motivo di banda: aprire la scheda di una scansione da 15 MB non deve
 * riscaricarla per intero solo per mostrarne un'anteprima.
 *
 * Disegnare davvero una pagina o ridurre una foto richiede un canvas che
 * sappia disegnare, e jsdom (dove girano questi test) non lo sa fare ---
 * stessa limitazione già documentata in extraction/pdf-extractor.test.ts.
 * Quello che si può e si deve verificare qui è il contratto attorno al
 * disegno vero: quali tipi si accettano, e che **non lanci mai** quando
 * non può disegnare --- una miniatura è un di più, e un file che non si
 * riesce a ridurre non deve impedire di salvarlo (prova completa, con un
 * browser vero, in tests/e2e/archive-thumbnails.spec.ts).
 */
import { describe, expect, it } from "vitest";
import { canHaveThumbnail, createThumbnail } from "@/lib/thumbnail";

describe("quali contenuti hanno una miniatura", () => {
  it("i PDF sì", () => {
    expect(canHaveThumbnail("application/pdf")).toBe(true);
  });

  it.each(["image/jpeg", "image/png", "image/webp"])("le immagini sì (%s)", (mimeType) => {
    expect(canHaveThumbnail(mimeType)).toBe(true);
  });

  it.each(["audio/webm", "video/mp4", "text/x-hinthial-note"])(
    "audio, video e note no (%s)",
    (mimeType) => {
      expect(canHaveThumbnail(mimeType)).toBe(false);
    },
  );
});

describe("createThumbnail non lancia mai", () => {
  it("torna null per un PDF quando non può disegnare (jsdom)", async () => {
    await expect(createThumbnail(new Uint8Array([1, 2, 3]), "application/pdf")).resolves.toBeNull();
  });

  it("torna null per un'immagine quando non può disegnare (jsdom)", async () => {
    await expect(createThumbnail(new Uint8Array([1, 2, 3]), "image/jpeg")).resolves.toBeNull();
  });

  it("torna null per un tipo senza miniatura, senza nemmeno provare", async () => {
    await expect(createThumbnail(new Uint8Array([1, 2, 3]), "audio/webm")).resolves.toBeNull();
  });

  it("torna null anche su byte del tutto invalidi", async () => {
    await expect(createThumbnail(new Uint8Array(0), "application/pdf")).resolves.toBeNull();
  });
});
