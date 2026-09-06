import { describe, expect, it } from "vitest";
import { groupAuditEventsByDay } from "@/domain/audit/group";
import type { AuditEventListItem } from "@/domain/audit/types";

// Costruite con il costruttore locale (non stringhe ISO/UTC): sia `now`
// che gli eventi vengono letti con i getter locali (getFullYear/Month/
// Date, v. group.ts), quindi il test resta indipendente dal fuso orario
// della macchina che lo esegue.
const NOW = new Date(2026, 8, 6, 12, 0, 0); // 6 settembre 2026, mezzogiorno locale

function event(id: string, date: Date): AuditEventListItem {
  return { id, type: "login", createdAt: date.toISOString() };
}

describe("groupAuditEventsByDay", () => {
  it("labels today's and yesterday's groups, and a real date for older ones", () => {
    const groups = groupAuditEventsByDay(
      [
        event("1", new Date(2026, 8, 6, 8, 0, 0)),
        event("2", new Date(2026, 8, 5, 20, 0, 0)),
        event("3", new Date(2026, 8, 1, 10, 0, 0)),
      ],
      NOW,
    );

    expect(groups.map((g) => g.label)).toEqual(["Oggi", "Ieri", "1 settembre 2026"]);
  });

  it("groups multiple events on the same day together, most recent group first", () => {
    const groups = groupAuditEventsByDay(
      [event("1", new Date(2026, 8, 6, 8, 0, 0)), event("2", new Date(2026, 8, 6, 9, 0, 0))],
      NOW,
    );

    expect(groups).toHaveLength(1);
    expect(groups[0].label).toBe("Oggi");
    expect(groups[0].events.map((e) => e.id)).toEqual(["1", "2"]);
  });

  it("returns no groups for an empty list", () => {
    expect(groupAuditEventsByDay([], NOW)).toEqual([]);
  });
});
