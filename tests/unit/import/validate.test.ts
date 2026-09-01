import { describe, expect, it } from "vitest";
import {
  findMissingColumns,
  parseAssetRows,
  parseContactRows,
  parseReminderRows,
} from "@/domain/import/validate";

describe("findMissingColumns", () => {
  it("finds no missing columns when the header matches the template", () => {
    expect(findMissingColumns(["Nome", "Email", "Ruolo"], "contacts")).toEqual([]);
  });

  it("reports required columns absent from the header", () => {
    expect(findMissingColumns(["Nome"], "contacts")).toEqual(["Email", "Ruolo"]);
  });

  it("doesn't flag an optional column as missing", () => {
    expect(findMissingColumns(["Nome"], "assets")).toEqual([]);
  });

  it("matches header labels case- and whitespace-insensitively", () => {
    expect(findMissingColumns([" nome ", " EMAIL", "ruolo"], "contacts")).toEqual([]);
  });
});

describe("parseContactRows", () => {
  const header = ["Nome", "Email", "Ruolo"];

  it("parses a valid row with no errors", () => {
    const [row] = parseContactRows([header, ["Maria Rossi", "maria@esempio.it", "Coniuge"]]);
    expect(row).toMatchObject({
      rowNumber: 2,
      name: "Maria Rossi",
      email: "maria@esempio.it",
      role: "Coniuge",
      fieldErrors: {},
    });
  });

  it("flags missing required fields", () => {
    const [row] = parseContactRows([header, ["", "", ""]]);
    expect(row.fieldErrors).toEqual({
      name: "Obbligatorio.",
      email: "Obbligatorio.",
      role: "Obbligatorio.",
    });
  });

  it("flags an invalid email", () => {
    const [row] = parseContactRows([header, ["Maria Rossi", "non-una-email", "Coniuge"]]);
    expect(row.fieldErrors.email).toBe("Email non valida.");
  });

  it("returns nothing for a file with only a header", () => {
    expect(parseContactRows([header])).toEqual([]);
  });
});

describe("parseAssetRows", () => {
  const header = ["Nome", "Categoria"];
  const categories = [{ id: "cat-1", name: "Immobili" }];

  it("resolves a category matched case-insensitively", () => {
    const [row] = parseAssetRows([header, ["Casa al mare", "immobili"]], categories);
    expect(row.category).toEqual({ kind: "matched", id: "cat-1", name: "Immobili" });
  });

  it("marks an unrecognized category as unresolved", () => {
    const [row] = parseAssetRows([header, ["Auto", "Veicoli"]], categories);
    expect(row.category).toEqual({ kind: "unresolved", rawName: "Veicoli" });
  });

  it("treats an empty category cell as optional, not unresolved", () => {
    const [row] = parseAssetRows([header, ["Auto", ""]], categories);
    expect(row.category).toEqual({ kind: "empty" });
  });

  it("flags a missing name", () => {
    const [row] = parseAssetRows([header, ["", "Immobili"]], categories);
    expect(row.fieldErrors.name).toBe("Obbligatorio.");
  });
});

describe("parseReminderRows", () => {
  const header = ["Titolo", "Data scadenza", "Asset collegato"];
  const assets = [{ id: "asset-1", name: "Auto Panda" }];

  it("parses an Italian-formatted date to ISO", () => {
    const [row] = parseReminderRows([header, ["Bollo auto", "15/03/2027", ""]], assets);
    expect(row.dueAtIso).toBe("2027-03-15");
    expect(row.fieldErrors.dueAt).toBeUndefined();
  });

  it("parses an ISO date as-is", () => {
    const [row] = parseReminderRows([header, ["Bollo auto", "2027-03-15", ""]], assets);
    expect(row.dueAtIso).toBe("2027-03-15");
  });

  it("flags an invalid date", () => {
    const [row] = parseReminderRows([header, ["Bollo auto", "31/02/2027", ""]], assets);
    expect(row.dueAtIso).toBeNull();
    expect(row.fieldErrors.dueAt).toContain("non valida");
  });

  it("flags a missing date as required, not invalid", () => {
    const [row] = parseReminderRows([header, ["Bollo auto", "", ""]], assets);
    expect(row.fieldErrors.dueAt).toBe("Obbligatorio.");
  });

  it("resolves the linked asset the same way categories resolve for assets", () => {
    const [row] = parseReminderRows([header, ["Bollo auto", "15/03/2027", "auto panda"]], assets);
    expect(row.asset).toEqual({ kind: "matched", id: "asset-1", name: "Auto Panda" });
  });
});
