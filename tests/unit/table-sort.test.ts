import { describe, expect, it } from "vitest";
import { applySort, compareLexicographically, toggleSort } from "@/lib/table-sort";

describe("compareLexicographically", () => {
  it("orders locale-aware, case-insensitive (like sortAlphabetically)", () => {
    expect(compareLexicographically("àbaco", "Zebra", "asc")).toBeLessThan(0);
    expect(compareLexicographically("mela", "MELA", "asc")).toBe(0);
  });

  it("reverses the result for \"desc\"", () => {
    const asc = compareLexicographically("a", "b", "asc");
    const desc = compareLexicographically("a", "b", "desc");
    expect(Math.sign(asc)).toBe(-Math.sign(desc));
  });
});

describe("toggleSort", () => {
  it("starts a new column at \"asc\"", () => {
    expect(toggleSort(null, "name")).toEqual({ key: "name", direction: "asc" });
    expect(toggleSort({ key: "size", direction: "desc" }, "name")).toEqual({
      key: "name",
      direction: "asc",
    });
  });

  it("flips direction on a second click of the same column", () => {
    expect(toggleSort({ key: "name", direction: "asc" }, "name")).toEqual({
      key: "name",
      direction: "desc",
    });
    expect(toggleSort({ key: "name", direction: "desc" }, "name")).toEqual({
      key: "name",
      direction: "asc",
    });
  });
});

describe("applySort", () => {
  const items = [{ id: "b", name: "Banana" }, { id: "a", name: "Ananas" }, { id: "c", name: "Ciliegia" }];

  it("returns the array untouched (same order) when sort is null", () => {
    expect(applySort(items, null, (item) => item.name)).toEqual(items);
  });

  it("sorts by the column's value, ascending then descending", () => {
    const asc = applySort(items, { key: "name", direction: "asc" }, (item) => item.name);
    expect(asc.map((i) => i.id)).toEqual(["a", "b", "c"]);

    const desc = applySort(items, { key: "name", direction: "desc" }, (item) => item.name);
    expect(desc.map((i) => i.id)).toEqual(["c", "b", "a"]);
  });

  it("does not mutate the original array", () => {
    const original = [...items];
    applySort(items, { key: "name", direction: "asc" }, (item) => item.name);
    expect(items).toEqual(original);
  });
});
