import { describe, expect, it } from "vitest";
import { normalizeFieldKey } from "@/domain/structured-fields/normalize";

describe("normalizeFieldKey", () => {
  it("collassa maiuscole, spazi e accenti sulla stessa chiave", () => {
    expect(normalizeFieldKey("Numero Polizza")).toBe("numero_polizza");
    expect(normalizeFieldKey("numero_polizza")).toBe("numero_polizza");
    expect(normalizeFieldKey("Città di nascita")).toBe("citta_di_nascita");
  });

  it("toglie underscore superflui ai margini", () => {
    expect(normalizeFieldKey("  targa veicolo  ")).toBe("targa_veicolo");
  });

  it("riduce punteggiatura e simboli a un solo underscore", () => {
    expect(normalizeFieldKey("N. Polizza / Contratto")).toBe("n_polizza_contratto");
  });
});
