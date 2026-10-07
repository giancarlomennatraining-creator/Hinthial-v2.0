import { describe, expect, it } from "vitest";
import { buildBento } from "@/domain/dashboard/bento";
import type { SummaryContext } from "@/domain/ai/types";
import type { ReminderListItem } from "@/domain/reminders/types";

const NOW = new Date(2026, 9, 7, 10, 30);

function on(dayOffset: number, hour = 9): string {
  return new Date(2026, 9, 7 + dayOffset, hour).toISOString();
}

function reminder(id: string, title: string, dayOffset: number, overrides: Partial<ReminderListItem> = {}): ReminderListItem {
  return {
    id, title, dueAt: on(dayOffset), completed: false,
    relatedDocumentId: null, relatedDocumentFilename: null, relatedAssetId: null, relatedAssetName: null,
    createdAt: "2026-01-01T00:00:00Z", ...overrides,
  };
}

function context(overrides: Partial<SummaryContext> = {}): SummaryContext {
  return { categories: [], assets: [], documents: [], reminders: [], friends: [], capsules: [], ...overrides };
}

const doc = (id: string, dayOffset: number) => ({ id, filename: `${id}.pdf`, categoryId: null, createdAt: on(dayOffset) }) as never;

describe("buildBento", () => {
  it("a vault vuoto non ha nulla di prossimo e non si rompe", () => {
    const data = buildBento(context(), NOW);
    expect(data.next).toBeNull();
    expect(data.nextCapsule).toBeNull();
    expect(data.assetRows).toEqual([]);
    expect(data.documentCount).toBe(0);
    expect(data.steps.done).toBe(2); // account e cifratura
    expect(data.steps.missing?.href).toBe("/archive");
  });

  it("la prossima scadenza è la più vicina da oggi in poi; le scadute si contano a parte", () => {
    const data = buildBento(
      context({ reminders: [reminder("a", "Revisione", -9), reminder("b", "Bollo", 5), reminder("c", "IMU", 70), reminder("d", "Fatta", 1, { completed: true })] }),
      NOW,
    );
    expect(data.next?.reminder.id).toBe("b");
    expect(data.next?.days).toBe(5);
    expect(data.overdueCount).toBe(1);
    expect(data.soonCount).toBe(1);
  });

  it("se sono tutte scadute, la prossima è la più vecchia", () => {
    const data = buildBento(context({ reminders: [reminder("a", "Revisione", -9), reminder("b", "Altra", -2)] }), NOW);
    expect(data.next?.reminder.id).toBe("a");
    expect(data.next?.days).toBe(-9);
  });

  it("conta i documenti nuovi della settimana e ne tiene tre per il ventaglio", () => {
    const data = buildBento(context({ documents: [doc("d1", 0), doc("d2", -2), doc("d3", -6), doc("d4", -20)] }), NOW);
    expect(data.documentCount).toBe(4);
    expect(data.newThisWeek).toBe(3);
    expect(data.recentDocuments.map((d) => d.id)).toEqual(["d1", "d2", "d3"]);
  });

  it("la prossima capsula è la più vicina ancora chiusa, col nome proprio del destinatario", () => {
    const capsules = [
      { id: "c1", title: "Per Luca", openAt: on(30), relatedFriends: [{ name: "Luca Bianchi", firstName: "Luca" }] },
      { id: "c2", title: "Vecchia", openAt: on(-3), relatedFriends: [] },
      { id: "c3", title: "Lontana", openAt: on(200), relatedFriends: [] },
    ] as never;
    const data = buildBento(context({ capsules }), NOW);
    expect(data.nextCapsule).toEqual({ title: "Per Luca", days: 30, recipient: "Luca" });
  });

  it("amici e guardiani", () => {
    const friends = [
      { id: "1", isFriend: true, isGuardian: true },
      { id: "2", isFriend: true, isGuardian: false },
      { id: "3", isFriend: false, isGuardian: false },
    ] as never;
    const data = buildBento(context({ friends }), NOW);
    expect(data.friendCount).toBe(2);
    expect(data.guardianCount).toBe(1);
  });

  it("i beni con una scadenza vengono prima, la più vicina per prima, e dicono quale", () => {
    const assets = [
      { id: "a1", name: "Bicicletta" },
      { id: "a2", name: "Casa" },
      { id: "a3", name: "Ford Focus" },
      { id: "a4", name: "Barca" },
    ] as never;
    const reminders = [
      reminder("r1", "Bolletta luce", 8, { relatedAssetId: "a2" }),
      reminder("r2", "RCA", 27, { relatedAssetId: "a3" }),
      reminder("r3", "Revisione", -9, { relatedAssetId: "a3" }),
    ];
    const data = buildBento(context({ assets, reminders }), NOW);
    expect(data.assetCount).toBe(4);
    // Ford Focus ha una scadenza già passata e una futura: conta quella passata, è la cosa da sistemare.
    expect(data.assetRows.map((r) => r.name)).toEqual(["Ford Focus", "Casa", "Barca"]);
    expect(data.assetRows[0]).toMatchObject({ detail: "Revisione · scaduta da 9 giorni", status: "over" });
    expect(data.assetRows[1]).toMatchObject({ detail: "Bolletta luce · tra 8 giorni", status: "soon" });
    expect(data.assetRows[2]).toMatchObject({ detail: "nessuna scadenza", status: "ok" });
  });

  it("un bene con solo scadenze già passate le segnala come scadute", () => {
    const assets = [{ id: "a3", name: "Ford Focus" }] as never;
    const data = buildBento(context({ assets, reminders: [reminder("r3", "Revisione", -9, { relatedAssetId: "a3" })] }), NOW);
    expect(data.assetRows[0]).toMatchObject({ detail: "Revisione · scaduta da 9 giorni", status: "over" });
  });
});
