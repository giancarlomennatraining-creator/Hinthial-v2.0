import { describe, expect, it } from "vitest";
import {
  BOOK_PAGES,
  CONSTELLATION_PEOPLE,
  HERO_HIGHLIGHT,
  HERO_TITLE,
  SEED_STEPS,
  activeSeedStep,
  deliveryStatus,
  hexLine,
  isDelivered,
  pseudoCipher,
} from "@/components/landing/landing-content";

const giulia = CONSTELLATION_PEOPLE.find((p) => p.name === "Giulia")!;
const paolo = CONSTELLATION_PEOPLE.find((p) => p.name === "Paolo")!;

describe("pagina pubblica", () => {
  it("il titolo evidenzia persona giusta e momento giusto", () => {
    const highlighted = HERO_TITLE.split(" ").filter((w) => HERO_HIGHLIGHT.has(w));
    expect(highlighted).toEqual(["persona", "giusta,", "momento", "giusto."]);
  });

  it("un passo del seme per pilastro, nell'ordine in cui l'albero cresce", () => {
    expect(SEED_STEPS.map((s) => s.section)).toEqual(["Raccontami", "Archivio", "Amici", "Capsule ed Eredità digitale"]);
  });

  it("il passo attivo è l'ultimo che ha superato la soglia", () => {
    expect(activeSeedStep([900, 1500, 2100, 2700], 500)).toBe(0);
    expect(activeSeedStep([400, 1000, 1600, 2200], 500)).toBe(1);
    expect(activeSeedStep([-1200, -600, 0, 499], 500)).toBe(4);
  });

  it("una capsula a data si apre dal suo anno in poi", () => {
    expect(isDelivered(giulia, 2030, false)).toBe(false);
    expect(isDelivered(giulia, 2031, false)).toBe(true);
    expect(deliveryStatus(giulia, 2030, false)).toBe("Si apre nel 2031");
    expect(deliveryStatus(giulia, 2031, true)).toBe("Aperta nel 2031");
  });

  it("una capsula d'eredità si apre solo se il proprietario non risponde più", () => {
    expect(isDelivered(paolo, 2045, false)).toBe(false);
    expect(deliveryStatus(paolo, 2045, false)).toBe("Solo se non rispondi più");
    expect(isDelivered(paolo, 2026, true)).toBe(true);
    expect(deliveryStatus(paolo, 2026, true)).toBe("Consegnata dall'Eredità digitale");
  });

  it("il testo cifrato finto è stabile, lungo come l'originale e illeggibile", () => {
    for (const page of BOOK_PAGES) {
      const cipher = pseudoCipher(page.body);
      expect(cipher).toHaveLength(page.body.length);
      expect(cipher).toBe(pseudoCipher(page.body));
      expect(cipher).not.toContain(" ");
    }
  });

  it("le righe esadecimali sono uguali a ogni chiamata (niente differenze tra server e browser)", () => {
    expect(hexLine(3)).toBe(hexLine(3));
    expect(hexLine(3)).not.toBe(hexLine(4));
    expect(hexLine(0)).toMatch(/^([0-9a-f]{6} ){5}[0-9a-f]{6}$/);
  });
});
