import { describe, expect, it } from "vitest";
import { findDateContext } from "@/domain/extraction/date-context";

describe("ritrovare una data nel testo", () => {
  const POLIZZA = "Emessa il 14 marzo 2026. Valida fino al 3 giugno 2027.";

  it("ritrova una data scritta in lettere partendo dal formato ISO", () => {
    expect(findDateContext(POLIZZA, "2027-06-03")).toContain("Valida fino al 3 giugno 2027");
  });

  it("ritrova anche l'altra data del documento", () => {
    expect(findDateContext(POLIZZA, "2026-03-14")).toContain("Emessa il 14 marzo 2026");
  });

  it("riconosce le date numeriche e quelle già in formato ISO", () => {
    expect(findDateContext("Scade il 03/06/2027.", "2027-06-03")).toContain("03/06/2027");
    expect(findDateContext("Data: 2027-06-03.", "2027-06-03")).toContain("2027-06-03");
  });

  it("dice di no quando la data non c'è", () => {
    expect(findDateContext(POLIZZA, "2030-01-01")).toBeNull();
  });
});
