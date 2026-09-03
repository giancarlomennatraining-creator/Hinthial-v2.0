/**
 * Modalità di visualizzazione (elenco / tabella impaginata) di ogni
 * sezione con liste --- a differenza del tema chiaro/scuro (v.
 * lib/theme.ts), è sincronizzata su tutti i dispositivi dell'utente:
 * vive in profiles.list_view_preferences (v. ListViewPreferencesProvider),
 * non in localStorage. Gestita da Impostazioni > Aspetto, con un
 * interruttore rapido anche in ogni sezione (v. ListViewToggle).
 */

export type ListSection = "archive" | "reminders" | "assets" | "contacts" | "capsules" | "timeline";

export type ListViewMode = "list" | "table";

export type ListViewPreferences = Partial<Record<ListSection, ListViewMode>>;

export const LIST_SECTIONS: ListSection[] = [
  "archive",
  "reminders",
  "assets",
  "contacts",
  "capsules",
  "timeline",
];

export const LIST_SECTION_LABEL: Record<ListSection, string> = {
  archive: "Archivio",
  reminders: "Scadenze",
  assets: "Asset",
  contacts: "Contatti fiduciari",
  capsules: "Capsule",
  timeline: "Cronologia",
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
    if (value === "list" || value === "table") {
      result[section] = value;
    }
  }
  return result;
}
