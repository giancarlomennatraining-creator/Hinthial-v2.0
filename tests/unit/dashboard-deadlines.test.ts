import { describe, expect, it } from "vitest";
import {
  addDaysIso,
  agoText,
  buildTodayPlan,
  dayKey,
  daysUntil,
  deadlineLevel,
  whenText,
} from "@/domain/dashboard/deadlines";
import { DASHBOARD_STYLE_OPTIONS, parseDashboardStyle } from "@/lib/dashboard-style";
import type { ReminderListItem } from "@/domain/reminders/types";

const NOW = new Date(2026, 9, 7, 10, 30); // mercoledì 7 ottobre 2026, 10:30

function at(dayOffset: number, hour = 9): string {
  return new Date(2026, 9, 7 + dayOffset, hour).toISOString();
}

function reminder(id: string, dayOffset: number, overrides: Partial<ReminderListItem> = {}): ReminderListItem {
  return {
    id,
    title: `Scadenza ${id}`,
    dueAt: at(dayOffset),
    completed: false,
    relatedDocumentId: null,
    relatedDocumentFilename: null,
    relatedAssetId: null,
    relatedAssetName: null,
    createdAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
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

describe("deadlineLevel", () => {
  it("distingue scaduta, entro una settimana, entro un mese, più in là", () => {
    expect(deadlineLevel(-1)).toBe("over");
    expect(deadlineLevel(0)).toBe("danger");
    expect(deadlineLevel(7)).toBe("danger");
    expect(deadlineLevel(8)).toBe("warn");
    expect(deadlineLevel(30)).toBe("warn");
    expect(deadlineLevel(31)).toBe("soft");
  });
});

describe("whenText", () => {
  it("dice quando in italiano", () => {
    expect(whenText(-9)).toBe("scaduta da 9 giorni");
    expect(whenText(-1)).toBe("scaduta ieri");
    expect(whenText(0)).toBe("oggi");
    expect(whenText(1)).toBe("domani");
    expect(whenText(5)).toBe("tra 5 giorni");
    expect(whenText(30)).toBe("tra 30 giorni");
    expect(whenText(45)).toBe("tra 2 mesi");
    expect(whenText(35)).toBe("tra 1 mese");
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

describe("addDaysIso", () => {
  it("sposta di n giorni di calendario mantenendo l'ora locale", () => {
    const moved = new Date(addDaysIso(at(0, 9), 7));
    expect(dayKey(moved)).toBe("2026-10-14");
    expect(moved.getHours()).toBe(9);
  });
});

describe("buildTodayPlan", () => {
  const reminders = [
    reminder("tardi", 60),
    reminder("scaduta", -9),
    reminder("bollo", 5),
    reminder("fatta", 2, { completed: true }),
    reminder("luce", 8),
    reminder("cardio", 14),
    reminder("rca", 27),
    reminder("imu", 70),
  ];

  it("mette in 'da fare' ciò che è scaduto o entro 7 giorni, il più urgente per primo, senza le già fatte", () => {
    const { actions } = buildTodayPlan(reminders, NOW);
    expect(actions.map((r) => r.id)).toEqual(["scaduta", "bollo"]);
  });

  it("tiene le tre successive come 'più avanti'", () => {
    const { later } = buildTodayPlan(reminders, NOW);
    expect(later.map((r) => r.id)).toEqual(["luce", "cardio", "rca"]);
  });

  it("costruisce i sette giorni da oggi con le scadenze di ciascuno", () => {
    const { week } = buildTodayPlan(reminders, NOW);
    expect(week).toHaveLength(7);
    expect(week[0].isToday).toBe(true);
    expect(week[0].key).toBe("2026-10-07");
    expect(week[5].key).toBe("2026-10-12");
    expect(week[5].items.map((r) => r.id)).toEqual(["bollo"]);
    expect(week[2].items).toEqual([]); // la "fatta" non compare
  });

  it("senza scadenze restituisce tutto vuoto ma la settimana c'è", () => {
    const plan = buildTodayPlan([], NOW);
    expect(plan.actions).toEqual([]);
    expect(plan.later).toEqual([]);
    expect(plan.week).toHaveLength(7);
  });
});

describe("parseDashboardStyle", () => {
  it("accetta gli stili conosciuti e ricade su Classica per il resto", () => {
    expect(parseDashboardStyle("today")).toBe("today");
    expect(parseDashboardStyle("classic")).toBe("classic");
    expect(parseDashboardStyle("bento")).toBe("bento");
    expect(parseDashboardStyle("stories")).toBe("classic"); // non ancora disponibile
    expect(parseDashboardStyle("boh")).toBe("classic");
    expect(parseDashboardStyle(null)).toBe("classic");
  });

  it("ogni opzione ha etichetta e spiegazione", () => {
    for (const option of DASHBOARD_STYLE_OPTIONS) {
      expect(option.label.length).toBeGreaterThan(0);
      expect(option.description.length).toBeGreaterThan(10);
    }
  });
});
