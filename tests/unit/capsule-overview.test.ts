import { describe, expect, it } from "vitest";
import {
  buildFutureLine,
  canCloseCapsule,
  capsuleChecks,
  isOpeningSoon,
  matchesCapsuleFilter,
  MAX_FUTURE_MARKERS,
  sortByOpening,
} from "@/domain/capsules/overview";

const NOW = new Date(2026, 9, 12, 12, 0, 0);

function inDays(days: number): string {
  return new Date(NOW.getTime() + days * 86_400_000).toISOString();
}

describe("capsuleChecks", () => {
  const friend = (name: string, linked: boolean) => ({ name, linkedUserId: linked ? "u1" : null }) as never;
  const base = { content: "", attachments: [], linkedDocuments: [], relatedFriends: [], openAt: inDays(400) };
  const stateOf = (checks: ReturnType<typeof capsuleChecks>, id: string) => checks.find((c) => c.id === id)?.state;

  it("senza lettera né allegato blocca, senza destinatario avvisa soltanto", () => {
    const checks = capsuleChecks(base, NOW);
    expect(stateOf(checks, "content")).toBe("todo");
    expect(stateOf(checks, "recipients")).toBe("warn");
    expect(canCloseCapsule(checks)).toBe(false);
  });

  it("basta una lettera, un allegato o un documento collegato per avere un contenuto", () => {
    for (const patch of [{ content: "Ciao" }, { attachments: [{}] }, { linkedDocuments: [{}] }]) {
      const checks = capsuleChecks({ ...base, ...(patch as object) } as never, NOW);
      expect(stateOf(checks, "content")).toBe("ok");
      expect(canCloseCapsule(checks)).toBe(true);
    }
  });

  it("una lettera di soli spazi non conta, e il contenuto dice parole e allegati", () => {
    expect(stateOf(capsuleChecks({ ...base, content: "  \n " }, NOW), "content")).toBe("todo");
    const checks = capsuleChecks({ ...base, content: "Caro Marco ti voglio bene", attachments: [{}, {}] } as never, NOW);
    expect(checks.find((c) => c.id === "content")?.detail).toBe("lettera di 5 parole e 2 allegati");
  });

  it("avvisa dei destinatari senza account, e non li cerca se non ci sono destinatari", () => {
    expect(capsuleChecks(base, NOW).some((c) => c.id === "accounts")).toBe(false);

    const one = capsuleChecks({ ...base, content: "x", relatedFriends: [friend("Marco", false), friend("Sofia", true)] }, NOW);
    expect(stateOf(one, "accounts")).toBe("warn");
    expect(one.find((c) => c.id === "accounts")?.detail).toBe("Marco non ha ancora un account Hinthial: non potrà aprirla.");

    const two = capsuleChecks({ ...base, content: "x", relatedFriends: [friend("Marco", false), friend("Anna", false)] }, NOW);
    expect(two.find((c) => c.id === "accounts")?.detail).toBe(
      "Marco e Anna non hanno ancora un account Hinthial: non potranno aprirla.",
    );

    const all = capsuleChecks({ ...base, content: "x", relatedFriends: [friend("Marco", true)] }, NOW);
    expect(stateOf(all, "accounts")).toBe("ok");
    expect(canCloseCapsule(all)).toBe(true);
  });

  it("una data passata avvisa, senza data blocca", () => {
    expect(stateOf(capsuleChecks({ ...base, content: "x", openAt: inDays(-1) }, NOW), "date")).toBe("warn");
    const noDate = capsuleChecks({ ...base, content: "x", openAt: null }, NOW);
    expect(stateOf(noDate, "date")).toBe("todo");
    expect(canCloseCapsule(noDate)).toBe(false);
  });
});

describe("isOpeningSoon e i filtri", () => {
  it("una capsula chiusa con la data entro 30 giorni si apre presto", () => {
    expect(isOpeningSoon({ status: "ready", openAt: inDays(12) }, NOW)).toBe(true);
    expect(isOpeningSoon({ status: "shared", openAt: inDays(30) }, NOW)).toBe(true);
  });

  it("non vale per una bozza, per una data troppo lontana o già passata", () => {
    expect(isOpeningSoon({ status: "draft", openAt: inDays(12) }, NOW)).toBe(false);
    expect(isOpeningSoon({ status: "ready", openAt: inDays(31) }, NOW)).toBe(false);
    expect(isOpeningSoon({ status: "ready", openAt: inDays(-1) }, NOW)).toBe(false);
    expect(isOpeningSoon({ status: "ready", openAt: null }, NOW)).toBe(false);
  });

  it("il filtro per stato e quello delle aperture vicine lasciano passare le capsule giuste", () => {
    const draft = { status: "draft" as const, openAt: inDays(5) };
    const soon = { status: "ready" as const, openAt: inDays(5) };
    expect(matchesCapsuleFilter(draft, "all", NOW)).toBe(true);
    expect(matchesCapsuleFilter(draft, "draft", NOW)).toBe(true);
    expect(matchesCapsuleFilter(soon, "draft", NOW)).toBe(false);
    expect(matchesCapsuleFilter(soon, "soon", NOW)).toBe(true);
    expect(matchesCapsuleFilter(draft, "soon", NOW)).toBe(false);
  });
});

describe("buildFutureLine", () => {
  const capsule = (id: string, openAt: string | null, status: "draft" | "ready" | "shared" = "ready") => ({
    id,
    title: `Capsula ${id}`,
    openAt,
    status,
  });

  it("non c'è senza aperture davanti", () => {
    expect(buildFutureLine([], NOW)).toBeNull();
    expect(buildFutureLine([capsule("a", null), capsule("b", inDays(-3))], NOW)).toBeNull();
  });

  it("mette le tappe in ordine di data, da 0 a 100, alternando sopra e sotto", () => {
    const line = buildFutureLine(
      [capsule("lontana", inDays(365 * 10)), capsule("vicina", inDays(30)), capsule("media", inDays(365 * 5))],
      NOW,
    )!;
    expect(line.markers.map((m) => m.id)).toEqual(["vicina", "media", "lontana"]);
    expect(line.markers.map((m) => m.side)).toEqual(["above", "below", "above"]);
    expect(line.markers[2].percent).toBeCloseTo(100, 5);
    expect(line.markers[0].percent).toBeGreaterThan(0);
    expect(line.markers[0].percent).toBeLessThan(line.markers[1].percent);
  });

  it("l'asse dura almeno un anno: una sola apertura tra due settimane non finisce in fondo", () => {
    const line = buildFutureLine([capsule("a", inDays(14))], NOW)!;
    expect(line.markers[0].percent).toBeLessThan(10);
  });

  it("le etichette degli anni sono al massimo sei e cadono sul primo gennaio", () => {
    const line = buildFutureLine([capsule("a", inDays(365 * 12))], NOW)!;
    expect(line.ticks.length).toBeGreaterThan(0);
    expect(line.ticks.length).toBeLessThanOrEqual(6);
    for (const tick of line.ticks) {
      const jan1 = new Date(tick.year, 0, 1).getTime();
      const expected = ((jan1 - NOW.getTime()) / (365 * 12 * 86_400_000)) * 100;
      expect(tick.percent).toBeCloseTo(expected, 5);
    }
  });

  it("disegna al massimo un certo numero di tappe e dice quante restano fuori", () => {
    const many = Array.from({ length: MAX_FUTURE_MARKERS + 3 }, (_, i) => capsule(String(i), inDays(40 + i * 20)));
    const line = buildFutureLine(many, NOW)!;
    expect(line.markers).toHaveLength(MAX_FUTURE_MARKERS);
    expect(line.hidden).toBe(3);
  });
});

describe("sortByOpening", () => {
  it("prima la prossima ad aprirsi, poi le più lontane, poi le già aperte, per ultime quelle senza data", () => {
    const items = [
      { id: "senza", openAt: null },
      { id: "passata", openAt: inDays(-10) },
      { id: "lontana", openAt: inDays(400) },
      { id: "vicina", openAt: inDays(5) },
      { id: "passata-recente", openAt: inDays(-2) },
    ];
    expect(sortByOpening(items, NOW).map((i) => i.id)).toEqual([
      "vicina",
      "lontana",
      "passata-recente",
      "passata",
      "senza",
    ]);
  });

  it("non cambia l'elenco che gli si passa", () => {
    const items = [{ openAt: inDays(9) }, { openAt: inDays(3) }];
    const copy = [...items];
    sortByOpening(items, NOW);
    expect(items).toEqual(copy);
  });
});
