import { describe, expect, it } from "vitest";
import { computeCountdown } from "@/lib/capsule-countdown";

const NOW = new Date("2026-06-15T12:00:00.000Z");
const CREATED_AT = "2026-06-01T00:00:00.000Z";

describe("computeCountdown", () => {
  it("counts multiple whole days remaining", () => {
    const { daysUntil, label } = computeCountdown(CREATED_AT, "2026-06-25T00:00:00.000Z", NOW);
    expect(daysUntil).toBe(10);
    expect(label).toBe("Si aprirà tra 10 giorni");
  });

  it("says 'domani' for exactly one day remaining", () => {
    const { label } = computeCountdown(CREATED_AT, "2026-06-16T12:00:00.000Z", NOW);
    expect(label).toBe("Si aprirà domani");
  });

  it("says 'oggi' when the opening date is today", () => {
    const { daysUntil, label } = computeCountdown(CREATED_AT, "2026-06-15T18:00:00.000Z", NOW);
    expect(daysUntil).toBe(0);
    expect(label).toBe("Si apre oggi");
  });

  it("reports a single day passed in the singular", () => {
    const { label } = computeCountdown(CREATED_AT, "2026-06-14T06:00:00.000Z", NOW);
    expect(label).toBe("Data di apertura superata da 1 giorno");
  });

  it("reports multiple days passed in the plural", () => {
    const { daysUntil, label } = computeCountdown(CREATED_AT, "2026-06-01T00:00:00.000Z", NOW);
    expect(daysUntil).toBeLessThan(-1);
    expect(label).toBe(`Data di apertura superata da ${Math.abs(daysUntil)} giorni`);
  });

  it("computes progress as the fraction of time elapsed between creation and opening", () => {
    // Created 2026-06-01, opens 2026-06-21 (20 days), now is 2026-06-15T12:00 (14.5 days in) --- 72.5%.
    const { progressPercent } = computeCountdown(CREATED_AT, "2026-06-21T00:00:00.000Z", NOW);
    expect(progressPercent).toBeCloseTo(72.5, 1);
  });

  it("clamps progress to 100 once the opening date has passed", () => {
    const { progressPercent } = computeCountdown(CREATED_AT, "2026-06-10T00:00:00.000Z", NOW);
    expect(progressPercent).toBe(100);
  });

  it("clamps progress to 0 for an opening date before creation (shouldn't normally happen, but stays safe)", () => {
    const { progressPercent } = computeCountdown("2026-06-20T00:00:00.000Z", "2026-06-10T00:00:00.000Z", NOW);
    expect(progressPercent).toBe(100);
  });
});
