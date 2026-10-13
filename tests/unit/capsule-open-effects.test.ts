import { describe, expect, it } from "vitest";
import {
  DEFAULT_OPEN_EFFECT,
  isOpenEffect,
  OPEN_EFFECT_OPTIONS,
  parseOpenEffect,
  splitLetterLines,
} from "@/domain/capsules/open-effects";
import { capsuleProgress } from "@/domain/capsules/overview";
import { capsuleArtState } from "@/components/capsules/CapsuleArt";

describe("gli effetti di apertura", () => {
  it("sono cinque, con nome e descrizione, e il default è lo sblocco discreto", () => {
    expect(OPEN_EFFECT_OPTIONS.map((o) => o.value)).toEqual(["discreet", "zoom", "hold", "deck", "light"]);
    for (const option of OPEN_EFFECT_OPTIONS) {
      expect(option.label.trim(), option.value).not.toBe("");
      expect(option.description.trim(), option.value).not.toBe("");
    }
    expect(DEFAULT_OPEN_EFFECT).toBe("discreet");
  });

  it("riconoscono un effetto valido e ripiegano sul default per tutto il resto (le capsule di prima non lo avevano)", () => {
    expect(isOpenEffect("deck")).toBe(true);
    expect(isOpenEffect("busta")).toBe(false);
    expect(parseOpenEffect("light")).toBe("light");
    for (const raw of [undefined, null, "", "busta", 3, {}]) expect(parseOpenEffect(raw)).toBe("discreet");
  });
});

describe("splitLetterLines", () => {
  it("una riga per ogni a capo, e un paragrafo lungo si divide alle frasi", () => {
    expect(splitLetterLines("Caro Marco,\nquando leggerai queste righe sarai grande. Qui c'è la ricetta! Ti voglio bene")).toEqual([
      "Caro Marco,",
      "quando leggerai queste righe sarai grande.",
      "Qui c'è la ricetta!",
      "Ti voglio bene",
    ]);
  });

  it("salta le righe vuote e gli spazi, e una lettera vuota non ha righe", () => {
    expect(splitLetterLines("  Uno  \n\n   \n Due ")).toEqual(["Uno", "Due"]);
    expect(splitLetterLines("")).toEqual([]);
    expect(splitLetterLines("  \n ")).toEqual([]);
  });
});

describe("capsuleProgress e capsuleArtState", () => {
  const created = "2026-01-01T00:00:00.000Z";
  const open = "2027-01-01T00:00:00.000Z";

  it("l'avanzamento va da 0 (creata) a 1 (si apre), e una bozza non è partita", () => {
    expect(capsuleProgress({ status: "ready", openAt: open, createdAt: created }, new Date(created))).toBe(0);
    expect(capsuleProgress({ status: "ready", openAt: open, createdAt: created }, new Date("2026-07-02T12:00:00.000Z"))).toBeCloseTo(0.5, 2);
    expect(capsuleProgress({ status: "ready", openAt: open, createdAt: created }, new Date("2030-01-01"))).toBe(1);
    expect(capsuleProgress({ status: "draft", openAt: open, createdAt: created }, new Date("2026-07-02"))).toBe(0);
    expect(capsuleProgress({ status: "ready", openAt: null, createdAt: created }, new Date("2026-07-02"))).toBe(0);
  });

  it("lo stato disegnato: bozza, sigillata o apribile", () => {
    const now = new Date("2026-07-02T00:00:00.000Z");
    expect(capsuleArtState({ status: "draft", openAt: open }, now)).toBe("draft");
    expect(capsuleArtState({ status: "ready", openAt: open }, now)).toBe("sealed");
    expect(capsuleArtState({ status: "shared", openAt: "2026-01-02T00:00:00.000Z" }, now)).toBe("ready");
    expect(capsuleArtState({ status: "ready", openAt: null }, now)).toBe("sealed");
  });
});
