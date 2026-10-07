import { describe, expect, it } from "vitest";
import { runSharesPurge } from "@/lib/shares/purge";

/** Un finto client con le sole chiamate che la pulizia usa. */
function fakeAdmin(rows: { id: string; owner_id: string }[], failFor: string[] = []) {
  const removed: string[][] = [];
  const updated: string[] = [];
  const client = {
    from: () => ({
      select: () => ({ is: () => ({ or: () => ({ limit: async () => ({ data: rows, error: null }) }) }) }),
      update: () => ({
        eq: async (_column: string, id: string) => {
          updated.push(id);
          return { error: null };
        },
      }),
    }),
    storage: {
      from: () => ({
        list: async (folder: string) =>
          failFor.some((id) => folder.endsWith(id))
            ? { data: null, error: { message: "boom" } }
            : { data: [{ name: "a.json" }, { name: "b.json" }], error: null },
        remove: async (paths: string[]) => {
          removed.push(paths);
          return { error: null };
        },
      }),
    },
  };
  return { client: client as never, removed, updated };
}

describe("runSharesPurge", () => {
  it("toglie le copie cifrate dei link scaduti o revocati e li segna ripuliti", async () => {
    const { client, removed, updated } = fakeAdmin([{ id: "s1", owner_id: "o1" }]);
    expect(await runSharesPurge(client, new Date("2026-10-07T00:00:00Z"))).toEqual({ purged: 1, failed: 0 });
    expect(removed).toEqual([["o1/s1/a.json", "o1/s1/b.json"]]);
    expect(updated).toEqual(["s1"]);
  });

  it("un link che non si riesce a ripulire resta in coda, e gli altri vanno avanti", async () => {
    const { client, updated } = fakeAdmin(
      [
        { id: "s1", owner_id: "o1" },
        { id: "s2", owner_id: "o1" },
      ],
      ["s1"],
    );
    expect(await runSharesPurge(client)).toEqual({ purged: 1, failed: 1 });
    expect(updated).toEqual(["s2"]);
  });

  it("senza nulla da ripulire non fa niente", async () => {
    const { client, removed } = fakeAdmin([]);
    expect(await runSharesPurge(client)).toEqual({ purged: 0, failed: 0 });
    expect(removed).toEqual([]);
  });
});
