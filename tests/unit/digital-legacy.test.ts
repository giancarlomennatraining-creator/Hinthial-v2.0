import { describe, expect, it } from "vitest";
import {
  DIGITAL_LEGACY_BOUNDS,
  DIGITAL_LEGACY_PRESET_ORDER,
  DIGITAL_LEGACY_PRESET_VALUES,
  clampDigitalLegacyField,
  describeDigitalLegacySettings,
  totalWorstCaseDays,
} from "@/domain/digital-legacy/types";

describe("DIGITAL_LEGACY_PRESET_VALUES", () => {
  it("orders the three presets from most to least cautious", () => {
    expect(DIGITAL_LEGACY_PRESET_ORDER).toEqual(["cautious", "balanced", "relaxed"]);
  });

  it("each preset's worst-case total gets shorter moving from cautious to relaxed", () => {
    const totals = DIGITAL_LEGACY_PRESET_ORDER.map((preset) =>
      totalWorstCaseDays(DIGITAL_LEGACY_PRESET_VALUES[preset]),
    );
    expect(totals[0]).toBeGreaterThan(totals[1]);
    expect(totals[1]).toBeGreaterThan(totals[2]);
  });

  it("every preset's numeric fields already fall within the allowed bounds", () => {
    for (const preset of DIGITAL_LEGACY_PRESET_ORDER) {
      const values = DIGITAL_LEGACY_PRESET_VALUES[preset];
      for (const field of Object.keys(DIGITAL_LEGACY_BOUNDS) as (keyof typeof DIGITAL_LEGACY_BOUNDS)[]) {
        const { min, max } = DIGITAL_LEGACY_BOUNDS[field];
        expect(values[field]).toBeGreaterThanOrEqual(min);
        expect(values[field]).toBeLessThanOrEqual(max);
      }
    }
  });
});

describe("clampDigitalLegacyField", () => {
  it("leaves an in-range value untouched", () => {
    expect(clampDigitalLegacyField("inactivityDays", 120)).toBe(120);
  });

  it("clamps a value below the minimum up to it", () => {
    expect(clampDigitalLegacyField("inactivityDays", 2)).toBe(DIGITAL_LEGACY_BOUNDS.inactivityDays.min);
  });

  it("clamps a value above the maximum down to it", () => {
    expect(clampDigitalLegacyField("inactivityDays", 10_000)).toBe(DIGITAL_LEGACY_BOUNDS.inactivityDays.max);
  });

  it("rounds a fractional value", () => {
    expect(clampDigitalLegacyField("reminderCount", 3.6)).toBe(4);
  });

  it("falls back to the minimum for a non-finite value (e.g. an empty/invalid input)", () => {
    expect(clampDigitalLegacyField("gracePeriodDays", Number.NaN)).toBe(DIGITAL_LEGACY_BOUNDS.gracePeriodDays.min);
  });
});

describe("describeDigitalLegacySettings", () => {
  it("mentions the guardian quorum in plain language, not the raw enum value", () => {
    const text = describeDigitalLegacySettings(DIGITAL_LEGACY_PRESET_VALUES.balanced);
    expect(text).toContain("maggioranza");
    expect(text).not.toContain("majority");
  });

  it("never lists the six numbers as a bare enumeration --- always inside a sentence", () => {
    const text = describeDigitalLegacySettings(DIGITAL_LEGACY_PRESET_VALUES.cautious);
    expect(text).toMatch(/^Aspettiamo/);
    expect(text).toContain("In totale");
  });
});
