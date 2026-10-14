import { describe, expect, it } from "vitest";
import { legacyPhases } from "@/domain/digital-legacy/phases";
import { DIGITAL_LEGACY_PRESET_VALUES } from "@/domain/digital-legacy/types";

describe("legacyPhases", () => {
  it("racconta quattro fasi nell'ordine in cui accadono", () => {
    const phases = legacyPhases(DIGITAL_LEGACY_PRESET_VALUES.balanced);
    expect(phases.map((p) => p.id)).toEqual(["silence", "guardians", "wait", "delivery"]);
    expect(phases.map((p) => p.name)).toEqual(["Silenzio", "Guardiani", "Attesa", "Consegna"]);
  });

  it("somma le durate come i preset: Normale = 180 giorni di silenzio e 28 di attesa", () => {
    const [silence, guardians, wait] = legacyPhases(DIGITAL_LEGACY_PRESET_VALUES.balanced);
    expect(silence.days).toBe(120 + 10 * 3 + 30);
    expect(guardians.days).toBeNull(); // dipende da quando rispondono
    expect(wait.days).toBe(14 + 14);
  });

  it("Prudente e Rilassato danno gli stessi totali dichiarati nel disegno", () => {
    const cautious = legacyPhases(DIGITAL_LEGACY_PRESET_VALUES.cautious);
    expect([cautious[0].days, cautious[2].days]).toEqual([296, 60]);
    const relaxed = legacyPhases(DIGITAL_LEGACY_PRESET_VALUES.relaxed);
    expect([relaxed[0].days, relaxed[2].days]).toEqual([88, 14]);
  });

  it("dice in parole quanti guardiani servono, secondo il preset", () => {
    expect(legacyPhases(DIGITAL_LEGACY_PRESET_VALUES.cautious)[1].text).toContain("devono essere tutti d'accordo");
    expect(legacyPhases(DIGITAL_LEGACY_PRESET_VALUES.balanced)[1].text).toContain("basta la maggioranza");
    expect(legacyPhases(DIGITAL_LEGACY_PRESET_VALUES.relaxed)[1].text).toContain("ne basta uno solo");
  });

  it("scrive i promemoria al singolare quando è uno solo", () => {
    const one = legacyPhases({ ...DIGITAL_LEGACY_PRESET_VALUES.balanced, reminderCount: 1 });
    expect(one[0].text).toContain("ti scrivo una volta");
  });
});
