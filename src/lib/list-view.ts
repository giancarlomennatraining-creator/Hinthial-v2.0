/**
 * Modalità di visualizzazione (elenco / tabella impaginata) di ogni
 * sezione con liste --- a differenza del tema chiaro/scuro (v.
 * lib/theme.ts), è sincronizzata su tutti i dispositivi dell'utente:
 * vive in profiles.list_view_preferences (v. ListViewPreferencesProvider),
 * non in localStorage. Gestita da Impostazioni > Aspetto, con un
 * interruttore rapido anche in ogni sezione (v. ListViewToggle).
 */

export type ListSection =
  | "archive"
  | "reminders"
  | "assets"
  | "friends"
  | "capsules"
  | "dossiers";

export type ListViewMode = "list" | "table";

/**
 * L'Archivio ha, oltre a elenco e tabella, quattro viste alternative (galleria, linea del tempo, collezioni,
 * scaffale): stessi documenti, un altro modo di trovarli quando sono molti. Le altre sezioni restano a due modi.
 */
export type ArchiveViewMode = ListViewMode | "gallery" | "timeline" | "collections" | "shelf";

const ARCHIVE_VIEW_MODES: ArchiveViewMode[] = ["list", "table", "gallery", "timeline", "collections", "shelf"];

export interface ArchiveViewOption {
  value: ArchiveViewMode;
  label: string;
  description: string;
}

export const ARCHIVE_VIEW_OPTIONS: ArchiveViewOption[] = [
  { value: "list", label: "Elenco", description: "La lista di sempre, con tutto sotto mano" },
  { value: "table", label: "Tabella", description: "Righe ordinabili, a pagine" },
  { value: "gallery", label: "Cassettiera", description: "Schede con miniatura e filtri a faccette" },
  { value: "timeline", label: "Linea del tempo", description: "Per mese, con la mappa dei mesi" },
  { value: "collections", label: "Collezioni", description: "Dall'insieme al dettaglio, per categoria" },
  { value: "shelf", label: "Scaffale", description: "Ogni documento è un dorso" },
];

export function isArchiveViewMode(value: unknown): value is ArchiveViewMode {
  return typeof value === "string" && (ARCHIVE_VIEW_MODES as string[]).includes(value);
}

export type ListViewPreferences = Partial<Record<Exclude<ListSection, "archive">, ListViewMode>> & {
  archive?: ArchiveViewMode;
};

export const LIST_SECTIONS: ListSection[] = [
  "archive",
  "reminders",
  "assets",
  "friends",
  "capsules",
  "dossiers",
];

export const LIST_SECTION_LABEL: Record<ListSection, string> = {
  archive: "Archivio",
  reminders: "Scadenze",
  assets: "Beni",
  friends: "Amici",
  capsules: "Capsule",
  dossiers: "Fascicoli",
};

export const DEFAULT_LIST_VIEW_MODE: ListViewMode = "list";

/** Quante righe per pagina in modalità tabellare, per tutte le sezioni. */
export const TABLE_PAGE_SIZE = 10;

/** Legge il valore grezzo (jsonb) dalla riga di profiles in un oggetto tipizzato, ignorando chiavi/valori inattesi. */
export function parseListViewPreferences(raw: unknown): ListViewPreferences {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};

  const result: ListViewPreferences = {};
  for (const section of LIST_SECTIONS) {
    const value = (raw as Record<string, unknown>)[section];
    if (section === "archive") {
      if (isArchiveViewMode(value)) result.archive = value;
    } else if (value === "list" || value === "table") {
      result[section] = value;
    }
  }
  return result;
}
