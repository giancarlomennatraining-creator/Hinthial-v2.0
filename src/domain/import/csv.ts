/**
 * Minimal RFC4180-ish CSV reader/writer, no dependency --- tollerante a `,`/`;` (Excel IT usa `;`), BOM UTF-8 (Windows
 * Excel lo scrive), e campi quotati con delimitatore/virgolette/a capo dentro.
 */

const BOM = "﻿";

function detectDelimiter(firstLine: string): "," | ";" {
  const commas = (firstLine.match(/,/g) ?? []).length;
  const semicolons = (firstLine.match(/;/g) ?? []).length;
  return semicolons > commas ? ";" : ",";
}

/** Parses CSV text into rows of raw string cells (no trimming, no type coercion). */
export function parseCsv(text: string): string[][] {
  const source = text.startsWith(BOM) ? text.slice(BOM.length) : text;
  if (source.trim() === "") return [];

  const firstLineEnd = source.search(/\r\n|\n|\r/);
  const firstLine = firstLineEnd === -1 ? source : source.slice(0, firstLineEnd);
  const delimiter = detectDelimiter(firstLine);

  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < source.length; i++) {
    const ch = source[i];

    if (inQuotes) {
      if (ch === '"') {
        if (source[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
    } else if (ch === delimiter) {
      row.push(field);
      field = "";
    } else if (ch === "\r") {
      // Swallowed; \n (or end of input) below closes the row.
    } else if (ch === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += ch;
    }
  }

  // Last row/field, unless the file ended cleanly on a newline.
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((r) => !(r.length === 1 && r[0].trim() === ""));
}

function escapeCell(value: string, delimiter: string): string {
  if (value.includes(delimiter) || value.includes('"') || value.includes("\n") || value.includes("\r")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/** CRLF + BOM UTF-8 per Excel. `delimiter` default `,`; i template generati usano `;` (v. templates.ts), parseCsv legge entrambi. */
export function serializeCsv(rows: string[][], delimiter: "," | ";" = ","): string {
  const body = rows.map((row) => row.map((cell) => escapeCell(cell, delimiter)).join(delimiter)).join("\r\n");
  return BOM + body + "\r\n";
}
