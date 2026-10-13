import { beforeEach, describe, expect, it, vi } from "vitest";
import { addPendingConfirmation, loadPendingConfirmation, removePendingConfirmation } from "@/domain/documents/pending-confirmation";

describe("documenti da confermare", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.useRealTimers();
  });

  it("parte vuota", () => {
    expect(loadPendingConfirmation("u1")).toEqual([]);
  });

  it("ricorda i documenti aggiunti, senza ripeterli", () => {
    addPendingConfirmation("u1", ["a", "b"]);
    addPendingConfirmation("u1", ["b", "c"]);
    expect(loadPendingConfirmation("u1")).toEqual(["a", "b", "c"]);
  });

  it("tiene separati gli utenti", () => {
    addPendingConfirmation("u1", ["a"]);
    addPendingConfirmation("u2", ["z"]);
    expect(loadPendingConfirmation("u1")).toEqual(["a"]);
    expect(loadPendingConfirmation("u2")).toEqual(["z"]);
  });

  it("toglie quelli confermati e, a elenco vuoto, non lascia nulla", () => {
    addPendingConfirmation("u1", ["a", "b"]);
    removePendingConfirmation("u1", ["a"]);
    expect(loadPendingConfirmation("u1")).toEqual(["b"]);
    removePendingConfirmation("u1", ["b"]);
    expect(window.localStorage.getItem("hinthial:pending-confirmation:u1")).toBeNull();
  });

  it("lascia cadere i promemoria troppo vecchi", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T10:00:00Z"));
    addPendingConfirmation("u1", ["vecchio"]);
    vi.setSystemTime(new Date("2026-03-01T10:00:00Z"));
    addPendingConfirmation("u1", ["nuovo"]);
    expect(loadPendingConfirmation("u1")).toEqual(["nuovo"]);
  });

  it("non si rompe con dati illeggibili", () => {
    window.localStorage.setItem("hinthial:pending-confirmation:u1", "{non json");
    expect(loadPendingConfirmation("u1")).toEqual([]);
    window.localStorage.setItem("hinthial:pending-confirmation:u1", JSON.stringify({ non: "un elenco" }));
    expect(loadPendingConfirmation("u1")).toEqual([]);
  });
});
