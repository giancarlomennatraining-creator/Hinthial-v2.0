import { describe, expect, it } from "vitest";
import { ARCHIVE_VIEW_OPTIONS, isArchiveViewMode, parseListViewPreferences } from "@/lib/list-view";

describe("preferenze delle viste", () => {
  it("l'Archivio accetta le sei viste, le altre sezioni solo elenco e tabella", () => {
    expect(
      parseListViewPreferences({ archive: "shelf", reminders: "table", assets: "gallery", friends: "list" }),
    ).toEqual({ archive: "shelf", reminders: "table", friends: "list" });
    for (const view of ["list", "table", "gallery", "timeline", "collections", "shelf"]) {
      expect(parseListViewPreferences({ archive: view })).toEqual({ archive: view });
    }
  });

  it("ignora valori e chiavi inattesi, e qualunque cosa non sia un oggetto", () => {
    expect(parseListViewPreferences({ archive: "carosello", altro: "table" })).toEqual({});
    expect(parseListViewPreferences(null)).toEqual({});
    expect(parseListViewPreferences("table")).toEqual({});
    expect(parseListViewPreferences(["table"])).toEqual({});
  });

  it("le opzioni del menu sono tutte e sole le viste valide, con un nome e una frase", () => {
    expect(ARCHIVE_VIEW_OPTIONS.map((o) => o.value)).toEqual(["list", "table", "gallery", "timeline", "collections", "shelf"]);
    for (const option of ARCHIVE_VIEW_OPTIONS) {
      expect(isArchiveViewMode(option.value)).toBe(true);
      expect(option.label).not.toBe("");
      expect(option.description).not.toBe("");
    }
    expect(isArchiveViewMode("mappa")).toBe(false);
  });
});
