import { describe, expect, it } from "vitest";
import { parseCsv, serializeCsv } from "@/domain/import/csv";

describe("parseCsv", () => {
  it("parses a simple comma-delimited file into rows of cells", () => {
    expect(parseCsv("Nome,Email\nMaria,maria@esempio.it\n")).toEqual([
      ["Nome", "Email"],
      ["Maria", "maria@esempio.it"],
    ]);
  });

  it("detects and parses a semicolon-delimited file (Excel, locale italiano)", () => {
    expect(parseCsv("Nome;Email\nMaria;maria@esempio.it\n")).toEqual([
      ["Nome", "Email"],
      ["Maria", "maria@esempio.it"],
    ]);
  });

  it("strips a leading UTF-8 BOM", () => {
    expect(parseCsv("﻿Nome,Email\nMaria,maria@esempio.it\n")).toEqual([
      ["Nome", "Email"],
      ["Maria", "maria@esempio.it"],
    ]);
  });

  it("handles quoted fields containing the delimiter, quotes, and newlines", () => {
    const csv = 'Nome,Note\n"Rossi, Maria","Ha detto ""ciao""\nsu due righe"\n';
    expect(parseCsv(csv)).toEqual([
      ["Nome", "Note"],
      ["Rossi, Maria", 'Ha detto "ciao"\nsu due righe'],
    ]);
  });

  it("tolerates CRLF line endings", () => {
    expect(parseCsv("a,b\r\n1,2\r\n")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  it("returns an empty array for an empty or whitespace-only file", () => {
    expect(parseCsv("")).toEqual([]);
    expect(parseCsv("   \n  ")).toEqual([]);
  });

  it("parses the last row even without a trailing newline", () => {
    expect(parseCsv("a,b\n1,2")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });
});

describe("serializeCsv", () => {
  it("round-trips through parseCsv", () => {
    const rows = [
      ["Nome", "Note"],
      ["Rossi, Maria", 'Con virgolette " e virgole, dentro'],
    ];
    expect(parseCsv(serializeCsv(rows))).toEqual(rows);
  });

  it("prefixes the output with a UTF-8 BOM", () => {
    expect(serializeCsv([["a"]]).charCodeAt(0)).toBe(0xfeff);
  });
});
