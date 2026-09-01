export type ImportKind = "contacts" | "assets" | "reminders";

/** One CSV column, described for both the template generator and the step-2 explanation. */
export interface ImportColumn {
  /** Internal field key --- not shown to the user. */
  key: string;
  /** CSV header text, also the on-screen column label. */
  label: string;
  required: boolean;
  description: string;
  example: string;
}

export interface ImportKindSpec {
  kind: ImportKind;
  label: string;
  /** Used to name the downloaded template/result files. */
  filenamePrefix: string;
  columns: ImportColumn[];
}

/**
 * How a name typed in the CSV (a category for an asset, an asset for a
 * reminder) resolves against what already exists in the account ---
 * matched case-insensitively on the exact name. "unresolved" is the one
 * state that blocks import: the step-4 preview lets the user turn it
 * into either "matched" (pick the right existing one) or "create" (make
 * a new one on the spot), the same interaction for both Asset->Categoria
 * and Scadenza->Asset.
 */
export type ReferenceResolution =
  | { kind: "empty" }
  | { kind: "matched"; id: string; name: string }
  | { kind: "unresolved"; rawName: string }
  | { kind: "create"; rawName: string };

export interface ContactRow {
  kind: "contacts";
  /** 1-based, counting the header as row 1 --- matches what the user sees if they open the CSV. */
  rowNumber: number;
  name: string;
  email: string;
  role: string;
  fieldErrors: Partial<Record<"name" | "email" | "role", string>>;
}

export interface AssetRow {
  kind: "assets";
  rowNumber: number;
  name: string;
  fieldErrors: Partial<Record<"name", string>>;
  category: ReferenceResolution;
}

export interface ReminderRow {
  kind: "reminders";
  rowNumber: number;
  title: string;
  /** Raw text as typed in the CSV (shown back on error). */
  dueAtRaw: string;
  /** Parsed to ISO (YYYY-MM-DD), or null if dueAtRaw couldn't be parsed. */
  dueAtIso: string | null;
  fieldErrors: Partial<Record<"title" | "dueAt", string>>;
  asset: ReferenceResolution;
}

export type ImportRow = ContactRow | AssetRow | ReminderRow;

/** True when a row has nothing left blocking it from being written. */
export function isRowReady(row: ImportRow): boolean {
  if (Object.keys(row.fieldErrors).length > 0) return false;
  if (row.kind === "assets") return row.category.kind !== "unresolved";
  if (row.kind === "reminders") return row.asset.kind !== "unresolved";
  return true;
}

export interface ImportRowResult {
  rowNumber: number;
  status: "imported" | "skipped";
  message?: string;
}
