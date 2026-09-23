/**
 * Gestione dei tag --- logica pura di aggiunta/rinomina/eliminazione e
 * aggregazione, tutta case-insensitive (v. domain/documents/tags.ts per
 * il perché: senza, "Casa"/"casa" resterebbero due tag distinti per
 * sempre, come già accade nel resto del codice oggi).
 */
import { describe, expect, it } from "vitest";
import {
  addTagToList,
  aggregateTags,
  listIncludesTag,
  removeTagFromList,
  renameTagInList,
} from "@/domain/documents/tags";

describe("addTagToList", () => {
  it("adds a new tag", () => {
    expect(addTagToList(["casa"], "lavoro")).toEqual(["casa", "lavoro"]);
  });

  it("trims whitespace before adding", () => {
    expect(addTagToList([], "  lavoro  ")).toEqual(["lavoro"]);
  });

  it("does not duplicate an existing tag with different casing", () => {
    expect(addTagToList(["Casa"], "casa")).toEqual(["Casa"]);
  });

  it("ignores an empty or whitespace-only tag", () => {
    expect(addTagToList(["casa"], "   ")).toEqual(["casa"]);
  });
});

describe("removeTagFromList", () => {
  it("removes a tag case-insensitively", () => {
    expect(removeTagFromList(["Casa", "lavoro"], "casa")).toEqual(["lavoro"]);
  });

  it("leaves the list untouched if the tag isn't present", () => {
    expect(removeTagFromList(["casa"], "lavoro")).toEqual(["casa"]);
  });
});

describe("renameTagInList", () => {
  it("renames a tag to a brand new name", () => {
    expect(renameTagInList(["casa", "lavoro"], "casa", "famiglia")).toEqual(["lavoro", "famiglia"]);
  });

  it("merges into an existing tag when the new name already exists", () => {
    // "Casa" già presente: rinominare "lavoro" in "casa" non deve
    // produrre due voci --- deve confluire in "Casa".
    expect(renameTagInList(["Casa", "lavoro"], "lavoro", "casa")).toEqual(["Casa"]);
  });

  it("does nothing if the old name isn't in the list", () => {
    expect(renameTagInList(["casa"], "lavoro", "famiglia")).toEqual(["casa"]);
  });
});

describe("listIncludesTag", () => {
  it("matches case-insensitively", () => {
    expect(listIncludesTag(["Casa"], "casa")).toBe(true);
  });

  it("is false when absent", () => {
    expect(listIncludesTag(["casa"], "lavoro")).toBe(false);
  });
});

describe("aggregateTags", () => {
  it("counts each tag across documents", () => {
    const usage = aggregateTags([{ tags: ["casa", "auto"] }, { tags: ["casa"] }, { tags: [] }]);
    expect(usage).toEqual([
      { name: "auto", count: 1 },
      { name: "casa", count: 2 },
    ]);
  });

  it("groups case-insensitively, showing the most frequent spelling", () => {
    const usage = aggregateTags([{ tags: ["casa"] }, { tags: ["casa"] }, { tags: ["Casa"] }]);
    expect(usage).toEqual([{ name: "casa", count: 3 }]);
  });

  it("returns an empty list when no document has tags", () => {
    expect(aggregateTags([{ tags: [] }, { tags: [] }])).toEqual([]);
  });

  it("sorts alphabetically", () => {
    const usage = aggregateTags([{ tags: ["zebra", "auto"] }]);
    expect(usage.map((u) => u.name)).toEqual(["auto", "zebra"]);
  });
});
