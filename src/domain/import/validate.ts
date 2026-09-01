import { IMPORT_KIND_SPECS } from "@/domain/import/templates";
import type {
  AssetRow,
  ContactRow,
  ImportKind,
  ImportKindSpec,
  ReferenceResolution,
  ReminderRow,
} from "@/domain/import/types";

/** A named, id-bearing entity to resolve a CSV reference column against --- Category or AssetListItem both fit. */
interface Referenceable {
  id: string;
  name: string;
}

function buildColumnIndex(header: string[], spec: ImportKindSpec): Map<string, number> {
  const normalized = header.map((h) => h.trim().toLowerCase());
  const index = new Map<string, number>();
  for (const col of spec.columns) {
    const i = normalized.indexOf(col.label.trim().toLowerCase());
    if (i !== -1) index.set(col.key, i);
  }
  return index;
}

/** Required columns whose label isn't present in the uploaded file's header at all --- a "wrong template" error, not a per-row one. */
export function findMissingColumns(header: string[], kind: ImportKind): string[] {
  const spec = IMPORT_KIND_SPECS[kind];
  const index = buildColumnIndex(header, spec);
  return spec.columns.filter((c) => c.required && !index.has(c.key)).map((c) => c.label);
}

function cell(row: string[], index: Map<string, number>, key: string): string {
  const i = index.get(key);
  return i === undefined || i >= row.length ? "" : row[i].trim();
}

function resolveReference(rawName: string, existing: Referenceable[]): ReferenceResolution {
  const trimmed = rawName.trim();
  if (!trimmed) return { kind: "empty" };
  const match = existing.find((e) => e.name.trim().toLowerCase() === trimmed.toLowerCase());
  return match ? { kind: "matched", id: match.id, name: match.name } : { kind: "unresolved", rawName: trimmed };
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function parseContactRows(csvRows: string[][]): ContactRow[] {
  if (csvRows.length < 2) return [];
  const [header, ...dataRows] = csvRows;
  const index = buildColumnIndex(header, IMPORT_KIND_SPECS.contacts);

  return dataRows.map((raw, i) => {
    const name = cell(raw, index, "name");
    const email = cell(raw, index, "email");
    const role = cell(raw, index, "role");

    const fieldErrors: ContactRow["fieldErrors"] = {};
    if (!name) fieldErrors.name = "Obbligatorio.";
    if (!email) fieldErrors.email = "Obbligatorio.";
    else if (!EMAIL_RE.test(email)) fieldErrors.email = "Email non valida.";
    if (!role) fieldErrors.role = "Obbligatorio.";

    return { kind: "contacts", rowNumber: i + 2, name, email, role, fieldErrors };
  });
}

export function parseAssetRows(csvRows: string[][], existingCategories: Referenceable[]): AssetRow[] {
  if (csvRows.length < 2) return [];
  const [header, ...dataRows] = csvRows;
  const index = buildColumnIndex(header, IMPORT_KIND_SPECS.assets);

  return dataRows.map((raw, i) => {
    const name = cell(raw, index, "name");
    const categoryName = cell(raw, index, "category");

    const fieldErrors: AssetRow["fieldErrors"] = {};
    if (!name) fieldErrors.name = "Obbligatorio.";

    return {
      kind: "assets",
      rowNumber: i + 2,
      name,
      fieldErrors,
      category: resolveReference(categoryName, existingCategories),
    };
  });
}

/** ISO (YYYY-MM-DD) or Italian GG/MM/AAAA (also GG-MM-AAAA) --- returns ISO, or null if unparseable/invalid. */
function parseFlexibleDate(raw: string): string | null {
  const trimmed = raw.trim();

  const iso = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) {
    const [, y, mo, d] = iso;
    return isValidDate(+y, +mo, +d) ? trimmed : null;
  }

  const italian = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (italian) {
    const [, d, mo, y] = italian;
    if (!isValidDate(+y, +mo, +d)) return null;
    return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  return null;
}

function isValidDate(year: number, month: number, day: number): boolean {
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export function parseReminderRows(csvRows: string[][], existingAssets: Referenceable[]): ReminderRow[] {
  if (csvRows.length < 2) return [];
  const [header, ...dataRows] = csvRows;
  const index = buildColumnIndex(header, IMPORT_KIND_SPECS.reminders);

  return dataRows.map((raw, i) => {
    const title = cell(raw, index, "title");
    const dueAtRaw = cell(raw, index, "dueAt");
    const assetName = cell(raw, index, "asset");
    const dueAtIso = dueAtRaw ? parseFlexibleDate(dueAtRaw) : null;

    const fieldErrors: ReminderRow["fieldErrors"] = {};
    if (!title) fieldErrors.title = "Obbligatorio.";
    if (!dueAtRaw) fieldErrors.dueAt = "Obbligatorio.";
    else if (!dueAtIso) fieldErrors.dueAt = "Data non valida (usa GG/MM/AAAA o AAAA-MM-GG).";

    return {
      kind: "reminders",
      rowNumber: i + 2,
      title,
      dueAtRaw,
      dueAtIso,
      fieldErrors,
      asset: resolveReference(assetName, existingAssets),
    };
  });
}
