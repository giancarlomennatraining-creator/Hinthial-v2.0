import { describe, expect, it } from "vitest";
import {
  canCloseCapsule,
  capsuleChecks,
  isOpeningSoon,
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
