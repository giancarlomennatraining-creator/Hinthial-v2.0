import { describe, expect, it } from "vitest";
import { generateTemplateCsv, IMPORT_KIND_SPECS, templateFilename } from "@/domain/import/templates";
import { parseCsv } from "@/domain/import/csv";

describe("generateTemplateCsv", () => {
  it("uses ; as the delimiter, matching Excel's Italian-locale default", () => {
    const csv = generateTemplateCsv("contacts");
    // BOM-stripped, first line only --- must contain the header's separators as `;`, not `,`.
    const firstLine = csv.replace(/^﻿/, "").split(/\r\n/)[0];
    expect(firstLine).toBe("Nome;Email;Ruolo");
  });

  it("still parses back correctly despite the ; delimiter (parseCsv auto-detects it)", () => {
    for (const kind of Object.keys(IMPORT_KIND_SPECS) as (keyof typeof IMPORT_KIND_SPECS)[]) {
      const spec = IMPORT_KIND_SPECS[kind];
      const rows = parseCsv(generateTemplateCsv(kind));
      expect(rows[0]).toEqual(spec.columns.map((c) => c.label));
      expect(rows[1]).toEqual(spec.columns.map((c) => c.example));
    }
  });
});

describe("templateFilename", () => {
  it("names the file after the kind's prefix", () => {
    expect(templateFilename("assets")).toBe("hinthial-template-asset.csv");
  });
});
