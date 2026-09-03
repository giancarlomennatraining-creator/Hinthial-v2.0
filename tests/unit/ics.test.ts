import { describe, expect, it } from "vitest";
import { buildIcsCalendar } from "@/lib/ics";

const FIXED_NOW = new Date("2026-06-15T10:00:00.000Z");

describe("buildIcsCalendar", () => {
  it("wraps events in a valid VCALENDAR envelope", () => {
    const ics = buildIcsCalendar(
      [{ id: "rem-1", title: "Rinnovo passaporto", dueAt: "2026-07-01T00:00:00.000Z" }],
      FIXED_NOW,
    );
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("VERSION:2.0");
    expect(ics).toContain("END:VCALENDAR");
    expect(ics).toContain("BEGIN:VEVENT");
    expect(ics).toContain("END:VEVENT");
  });

  it("encodes the due date as an all-day DTSTART in local time", () => {
    const ics = buildIcsCalendar(
      [{ id: "rem-1", title: "Revisione auto", dueAt: "2026-03-05T00:00:00.000Z" }],
      FIXED_NOW,
    );
    // The exact YYYYMMDD depends on the runner's local timezone (toIcsDate uses local getters,
    // matching how dueAt is displayed elsewhere in the app) --- just check the shape and that
    // it lands within a day of the UTC date given.
    expect(ics).toMatch(/DTSTART;VALUE=DATE:2026030[45]/);
  });

  it("includes one VEVENT per reminder, each with its own UID", () => {
    const ics = buildIcsCalendar(
      [
        { id: "rem-1", title: "Uno", dueAt: "2026-07-01T00:00:00.000Z" },
        { id: "rem-2", title: "Due", dueAt: "2026-08-01T00:00:00.000Z" },
      ],
      FIXED_NOW,
    );
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(2);
    expect(ics).toContain("UID:rem-1@hinthial.app");
    expect(ics).toContain("UID:rem-2@hinthial.app");
  });

  it("escapes characters that are significant in the .ics text format", () => {
    const ics = buildIcsCalendar(
      [{ id: "rem-1", title: "Nota; con virgola, e newline\ndentro", dueAt: "2026-07-01T00:00:00.000Z" }],
      FIXED_NOW,
    );
    expect(ics).toContain("SUMMARY:Nota\\; con virgola\\, e newline\\ndentro");
  });

  it("produces an empty-but-valid calendar for zero events", () => {
    const ics = buildIcsCalendar([], FIXED_NOW);
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("END:VCALENDAR");
    expect(ics).not.toContain("BEGIN:VEVENT");
  });

  it("uses CRLF line endings, as required by RFC 5545", () => {
    const ics = buildIcsCalendar(
      [{ id: "rem-1", title: "Uno", dueAt: "2026-07-01T00:00:00.000Z" }],
      FIXED_NOW,
    );
    expect(ics).toContain("\r\n");
    expect(ics.split("\r\n").every((line) => !line.includes("\n"))).toBe(true);
  });
});
