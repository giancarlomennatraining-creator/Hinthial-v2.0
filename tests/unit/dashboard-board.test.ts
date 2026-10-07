import { describe, expect, it } from "vitest";
import { buildBoard, columnOf, planMove, BOARD_DONE_LIMIT } from "@/domain/dashboard/board";
import { dayKey, daysUntil } from "@/domain/dashboard/deadlines";
import type { ReminderListItem } from "@/domain/reminders/types";

const NOW = new Date(2026, 9, 7, 10, 30);

function reminder(id: string, dayOffset: number, overrides: Partial<ReminderListItem> = {}): ReminderListItem {
  return {
    id,
    title: `Scadenza ${id}`,
    dueAt: new Date(2026, 9, 7 + dayOffset, 9, 15).toISOString(),
    completed: false,
    relatedDocumentId: null,
    relatedDocumentFilename: null,
    relatedAssetId: null,
    relatedAssetName: null,
    createdAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("columnOf", () => {
  it("mette ogni scadenza nella colonna del suo tempo; le completate in 'Fatte'", () => {
    expect(columnOf(reminder("a", -1), NOW)).toBe("over");
    expect(columnOf(reminder("b", 0), NOW)).toBe("week");
    expect(columnOf(reminder("c", 7), NOW)).toBe("week");
    expect(columnOf(reminder("d", 8), NOW)).toBe("month");
    expect(columnOf(reminder("e", 30), NOW)).toBe("month");
    expect(columnOf(reminder("f", 31), NOW)).toBe("later");
    expect(columnOf(reminder("g", -20, { completed: true }), NOW)).toBe("done");
  });
});

describe("buildBoard", () => {
  it("divide per colonna in ordine di data, e tiene in 'Fatte' solo le ultime, le più recenti per prime", () => {
    const done = Array.from({ length: BOARD_DONE_LIMIT + 2 }, (_, i) => reminder(`d${i}`, -30 + i, { completed: true }));
    const board = buildBoard([reminder("l", 60), reminder("w", 3), reminder("o", -5), reminder("m", 20), reminder("w2", 1), ...done], NOW);

    expect(board.over.map((r) => r.id)).toEqual(["o"]);
    expect(board.week.map((r) => r.id)).toEqual(["w2", "w"]);
    expect(board.month.map((r) => r.id)).toEqual(["m"]);
    expect(board.later.map((r) => r.id)).toEqual(["l"]);
    expect(board.done).toHaveLength(BOARD_DONE_LIMIT);
    expect(board.done[0].id).toBe(`d${BOARD_DONE_LIMIT + 1}`);
  });
});

describe("planMove", () => {
  it("rilasciare nella stessa colonna non fa nulla", () => {
    expect(planMove(reminder("a", 3), "week", NOW)).toEqual({ kind: "none" });
    expect(planMove(reminder("a", -3), "over", NOW)).toEqual({ kind: "none" });
  });

  it("in 'Da sistemare' non si può: si riempie da sola con il passare del tempo", () => {
    const move = planMove(reminder("a", 3), "over", NOW);
    expect(move.kind).toBe("refused");
  });

  it("in 'Fatte' la segna completata senza toccare la data", () => {
    expect(planMove(reminder("a", 3), "done", NOW)).toEqual({ kind: "move", completed: true, dueAt: null });
    expect(planMove(reminder("a", -9), "done", NOW)).toEqual({ kind: "move", completed: true, dueAt: null });
  });

  it("verso un'altra colonna di date sposta la scadenza a un giorno di quella colonna, alla stessa ora", () => {
    const toMonth = planMove(reminder("a", 3), "month", NOW);
    expect(toMonth.kind).toBe("move");
    if (toMonth.kind !== "move") return;
    expect(toMonth.completed).toBe(false);
    const moved = new Date(toMonth.dueAt!);
    expect(daysUntil(toMonth.dueAt!, NOW)).toBe(20);
    expect(columnOf(reminder("x", 0, { dueAt: toMonth.dueAt! }), NOW)).toBe("month");
    expect([moved.getHours(), moved.getMinutes()]).toEqual([9, 15]);

    const toWeek = planMove(reminder("b", 60), "week", NOW);
    expect(toWeek.kind === "move" && daysUntil(toWeek.dueAt!, NOW)).toBe(4);
    const toLater = planMove(reminder("c", 3), "later", NOW);
    expect(toLater.kind === "move" && daysUntil(toLater.dueAt!, NOW)).toBe(60);
  });

  it("una scaduta portata in 'Questa settimana' riparte da oggi, non da una data passata", () => {
    const move = planMove(reminder("a", -9), "week", NOW);
    expect(move.kind === "move" && dayKey(new Date(move.dueAt!))).toBe("2026-10-11");
  });

  it("una 'Fatta' riportata in una colonna torna aperta; se la sua data è già lì, resta quella", () => {
    const stillWeek = planMove(reminder("a", 3, { completed: true }), "week", NOW);
    expect(stillWeek).toEqual({ kind: "move", completed: false, dueAt: null });

    const farAway = planMove(reminder("b", -20, { completed: true }), "month", NOW);
    expect(farAway.kind).toBe("move");
    expect(farAway.kind === "move" && farAway.completed).toBe(false);
    expect(farAway.kind === "move" && daysUntil(farAway.dueAt!, NOW)).toBe(20);
  });
});
