import { describe, expect, it } from "vitest";
import { agoText, dayKey, daysUntil } from "@/domain/dashboard/deadlines";

const NOW = new Date(2026, 9, 7, 10, 30); // mercoledì 7 ottobre 2026, 10:30

function at(dayOffset: number, hour = 9): string {
  return new Date(2026, 9, 7 + dayOffset, hour).toISOString();
}

describe("daysUntil", () => {
  it("conta giorni di calendario, non intervalli di 24 ore", () => {
    expect(daysUntil(at(0, 8), NOW)).toBe(0); // oggi, anche se l'ora è già passata
    expect(daysUntil(at(0, 23), NOW)).toBe(0);
    expect(daysUntil(at(1, 0), NOW)).toBe(1);
    expect(daysUntil(at(-1, 23), NOW)).toBe(-1);
    expect(daysUntil(at(9), NOW)).toBe(9);
  });
});

describe("agoText", () => {
  it("dice da quanto, poi dà la data", () => {
    expect(agoText(at(0, 8), NOW)).toBe("oggi");
    expect(agoText(at(-1, 20), NOW)).toBe("ieri");
    expect(agoText(at(-3), NOW)).toBe("3 giorni fa");
    expect(agoText(at(-30), NOW)).toMatch(/set/);
    expect(agoText(at(2), NOW)).toBe("oggi"); // mai "tra due giorni" per qualcosa già aggiunto
  });
});

describe("dayKey", () => {
  it("dà il giorno di calendario nel fuso dell'utente, con gli zeri", () => {
    expect(dayKey(new Date(2026, 0, 5, 23, 59))).toBe("2026-01-05");
    expect(dayKey(new Date(2026, 11, 31))).toBe("2026-12-31");
  });
});
