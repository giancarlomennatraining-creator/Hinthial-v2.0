import { describe, expect, it } from "vitest";
import {
  DIGITAL_LEGACY_BOUNDS,
  DIGITAL_LEGACY_PRESET_ORDER,
  DIGITAL_LEGACY_PRESET_VALUES,
  clampDigitalLegacyField,
  computeDigitalLegacyTransition,
  describeDigitalLegacySettings,
  totalWorstCaseDays,
  type DigitalLegacyRuntimeState,
} from "@/domain/digital-legacy/types";

const NOW = new Date("2026-06-01T00:00:00.000Z");
const DAY = 86_400_000;
const settings = DIGITAL_LEGACY_PRESET_VALUES.balanced; // 120/10/3/30/majority/14/14

function runtime(overrides: Partial<DigitalLegacyRuntimeState> = {}): DigitalLegacyRuntimeState {
  return {
    state: "normal",
    stateEnteredAt: new Date(NOW.getTime() - 200 * DAY).toISOString(),
    remindersSent: 0,
    lastReminderAt: null,
    ...overrides,
  };
}

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

describe("computeDigitalLegacyTransition", () => {
  it("does nothing while still within the inactivity threshold", () => {
    const action = computeDigitalLegacyTransition({
      now: NOW,
      lastSignInAt: new Date(NOW.getTime() - 100 * DAY), // < 120
      settings,
      runtime: runtime(),
    });
    expect(action).toEqual({ type: "none" });
  });

  it("starts reminding (and sends the first reminder in the same step) once past the inactivity threshold", () => {
    const action = computeDigitalLegacyTransition({
      now: NOW,
      lastSignInAt: new Date(NOW.getTime() - 121 * DAY), // >= 120
      settings,
      runtime: runtime({ state: "normal" }),
    });
    expect(action).toEqual({ type: "send_reminder", reminderNumber: 1, enteringReminding: true });
  });

  it("does not repeat a reminder before the interval has elapsed", () => {
    const action = computeDigitalLegacyTransition({
      now: NOW,
      lastSignInAt: new Date(NOW.getTime() - 121 * DAY),
      settings,
      runtime: runtime({
        state: "reminding",
        stateEnteredAt: new Date(NOW.getTime() - 5 * DAY).toISOString(),
        remindersSent: 1,
        lastReminderAt: new Date(NOW.getTime() - 5 * DAY).toISOString(), // < 10 days ago
      }),
    });
    expect(action).toEqual({ type: "none" });
  });

  it("sends the next reminder once the interval has elapsed", () => {
    const action = computeDigitalLegacyTransition({
      now: NOW,
      lastSignInAt: new Date(NOW.getTime() - 140 * DAY),
      settings,
      runtime: runtime({
        state: "reminding",
        stateEnteredAt: new Date(NOW.getTime() - 20 * DAY).toISOString(),
        remindersSent: 1,
        lastReminderAt: new Date(NOW.getTime() - 10 * DAY).toISOString(), // >= 10 days ago
      }),
    });
    expect(action).toEqual({ type: "send_reminder", reminderNumber: 2, enteringReminding: false });
  });

  it("moves to the grace period once every reminder (reminderCount) has been sent", () => {
    const action = computeDigitalLegacyTransition({
      now: NOW,
      lastSignInAt: new Date(NOW.getTime() - 200 * DAY),
      settings,
      runtime: runtime({
        state: "reminding",
        stateEnteredAt: new Date(NOW.getTime() - 40 * DAY).toISOString(),
        remindersSent: settings.reminderCount, // 3 --- all already sent
        lastReminderAt: new Date(NOW.getTime() - 10 * DAY).toISOString(),
      }),
    });
    expect(action).toEqual({ type: "start_grace_period" });
  });

  it("moves to awaiting_guardians once the grace period has elapsed", () => {
    const action = computeDigitalLegacyTransition({
      now: NOW,
      lastSignInAt: new Date(NOW.getTime() - 200 * DAY),
      settings,
      runtime: runtime({
        state: "grace_period",
        stateEnteredAt: new Date(NOW.getTime() - 31 * DAY).toISOString(), // >= 30
      }),
    });
    expect(action).toEqual({ type: "start_awaiting_guardians" });
  });

  it("never advances further once in awaiting_guardians --- a future phase must pick it up", () => {
    const action = computeDigitalLegacyTransition({
      now: NOW,
      lastSignInAt: new Date(NOW.getTime() - 200 * DAY),
      settings,
      runtime: runtime({
        state: "awaiting_guardians",
        stateEnteredAt: new Date(NOW.getTime() - 100 * DAY).toISOString(),
      }),
    });
    expect(action).toEqual({ type: "none" });
  });

  it("resets to normal from any non-normal state as soon as a login after the state started is seen", () => {
    for (const state of ["reminding", "grace_period", "awaiting_guardians"] as const) {
      const action = computeDigitalLegacyTransition({
        now: NOW,
        lastSignInAt: new Date(NOW.getTime() - 1 * DAY), // logged in AFTER the state began
        settings,
        runtime: runtime({ state, stateEnteredAt: new Date(NOW.getTime() - 5 * DAY).toISOString() }),
      });
      expect(action).toEqual({ type: "reset" });
    }
  });

  it("does not reset on a login that predates the current state (stale last_sign_in_at)", () => {
    const action = computeDigitalLegacyTransition({
      now: NOW,
      lastSignInAt: new Date(NOW.getTime() - 10 * DAY), // BEFORE the state began
      settings,
      runtime: runtime({
        state: "reminding",
        stateEnteredAt: new Date(NOW.getTime() - 5 * DAY).toISOString(),
        remindersSent: 1,
        lastReminderAt: new Date(NOW.getTime() - 5 * DAY).toISOString(),
      }),
    });
    expect(action).not.toEqual({ type: "reset" });
  });
});
