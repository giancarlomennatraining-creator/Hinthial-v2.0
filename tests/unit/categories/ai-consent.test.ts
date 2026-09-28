import { describe, expect, it } from "vitest";
import { isCategoryEnabledForExtraction } from "@/domain/categories/ai-consent";

const NOW = new Date("2026-09-28T12:00:00Z");

describe("isCategoryEnabledForExtraction", () => {
  it("è falso di default (nessuno dei due consensi impostato)", () => {
    expect(isCategoryEnabledForExtraction({ aiExtractionEnabled: false, aiExtractionEnabledUntil: null }, NOW)).toBe(
      false,
    );
  });

  it("è vero col consenso permanente, indipendentemente da un eventuale consenso temporaneo", () => {
    expect(
      isCategoryEnabledForExtraction({ aiExtractionEnabled: true, aiExtractionEnabledUntil: null }, NOW),
    ).toBe(true);
  });

  it("è vero col consenso temporaneo ancora nel futuro", () => {
    expect(
      isCategoryEnabledForExtraction(
        { aiExtractionEnabled: false, aiExtractionEnabledUntil: "2026-10-28T12:00:00Z" },
        NOW,
      ),
    ).toBe(true);
  });

  it("è falso col consenso temporaneo già scaduto", () => {
    expect(
      isCategoryEnabledForExtraction(
        { aiExtractionEnabled: false, aiExtractionEnabledUntil: "2026-09-01T12:00:00Z" },
        NOW,
      ),
    ).toBe(false);
  });
});
