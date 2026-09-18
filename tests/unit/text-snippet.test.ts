import { describe, expect, it } from "vitest";
import { findTextSnippet, flattenForSearch } from "@/lib/text-snippet";

const REFERTO =
  "Azienda Ospedaliera di Milano --- reparto di cardiologia. Referto della visita del 14 marzo 2026, " +
  "dottor Ferrari. Si consiglia un ricontrollo tra sei mesi.";

describe("findTextSnippet (FASE 17b)", () => {
  it("restituisce il contorno della parola trovata", () => {
    const snippet = findTextSnippet(REFERTO, "cardiologia");

    expect(snippet).not.toBeNull();
    expect(snippet!.match).toBe("cardiologia");
    expect(snippet!.before).toContain("reparto di ");
    expect(snippet!.after).toContain("Referto");
  });

  it("conserva la forma del testo, non quella digitata", () => {
    const snippet = findTextSnippet("Polizza RCA autoveicoli", "POLIZZA");
    expect(snippet!.match).toBe("Polizza");
  });

  it("segnala quando il testo continua oltre lo spezzone", () => {
    const long = `${"parola ".repeat(80)}cardiologia${" parola".repeat(80)}`;
    const snippet = findTextSnippet(long, "cardiologia");

    expect(snippet!.truncatedStart).toBe(true);
    expect(snippet!.truncatedEnd).toBe(true);
  });

  it("non taglia nulla quando il testo è già corto", () => {
    const snippet = findTextSnippet("referto di cardiologia", "cardiologia");

    expect(snippet!.truncatedStart).toBe(false);
    expect(snippet!.truncatedEnd).toBe(false);
  });

  it("sceglie la prima corrispondenza quando i termini sono più d'uno", () => {
    const snippet = findTextSnippet(REFERTO, "ferrari cardiologia");
    expect(snippet!.match).toBe("cardiologia");
  });

  it("restituisce null quando la parola non c'è --- il documento è stato trovato per altro", () => {
    expect(findTextSnippet(REFERTO, "ortopedia")).toBeNull();
  });

  it("ignora i termini troppo corti, come fa la ricerca", () => {
    expect(findTextSnippet(REFERTO, "di")).toBeNull();
  });

  it("gestisce un testo vuoto senza lanciare", () => {
    expect(findTextSnippet("", "cardiologia")).toBeNull();
    expect(findTextSnippet("   ", "cardiologia")).toBeNull();
  });

  // FASE 17e --- il testo estratto conserva ora l'impaginazione del
  // documento, perché viene mostrato all'utente. La ricerca non deve
  // accorgersene: è la regressione più facile da introdurre e la più
  // difficile da notare, perché fallisce solo su certe frasi.
  describe("l'impaginazione del documento non deve disturbare la ricerca", () => {
    it("trova una frase che nel documento sta su due righe", () => {
      const snippet = findTextSnippet("reparto di\ncardiologia pediatrica", "cardiologia");
      expect(snippet!.match).toBe("cardiologia");
    });

    it("lo spezzone resta su una riga sola", () => {
      const snippet = findTextSnippet("Referto\n\ndi cardiologia\ndel 14 marzo", "cardiologia");
      expect(`${snippet!.before}${snippet!.match}${snippet!.after}`).not.toContain("\n");
    });

    it("appiattisce anche l'aggancio del termine a capo", () => {
      expect(flattenForSearch("prima\n\nseconda")).toBe("prima seconda");
      expect(flattenForSearch("gia'\tunica riga")).toBe("gia' unica riga");
    });
  });
});
