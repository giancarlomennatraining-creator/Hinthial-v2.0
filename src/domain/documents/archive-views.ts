import type { Category } from "@/domain/categories/types";
import type { AssetListItem } from "@/domain/assets/types";
import type { DocumentSummary } from "@/domain/documents/types";

/**
 * La parte pura dell'Archivio: colori delle categorie, urgenza delle scadenze, date leggibili e ricerca. Nessuna rete e
 * nessun database: lavora sui riassunti dei documenti già decifrati in pagina.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

// ---------------------------------------------------------------------------------------------------------------
// Colori delle categorie
// ---------------------------------------------------------------------------------------------------------------

/** Il colore di una categoria è stabile e dipende dal nome: le categorie non ne hanno uno proprio. */
const KNOWN_CATEGORY_COLORS: Record<string, string> = {
  assicurazioni: "#2b4fc4",
  casa: "#0f8b8d",
  salute: "#c2417a",
  fiscale: "#a9731a",
  veicoli: "#6d4fc4",
  auto: "#6d4fc4",
  finanze: "#1c7c5a",
  personale: "#475569",
  identita: "#475569",
  contratti: "#8a5a2b",
  account: "#0f6fa8",
  altro: "#6b7391",
};

const FALLBACK_PALETTE = ["#2b4fc4", "#0f8b8d", "#c2417a", "#a9731a", "#6d4fc4", "#1c7c5a", "#0f6fa8", "#b4532a"];

export const UNCATEGORIZED_COLOR = "#9aa1bd";
function normalizeName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

function hashString(value: string): number {
  let h = 0;
  for (let i = 0; i < value.length; i += 1) h = (h * 31 + value.charCodeAt(i)) >>> 0;
  return h;
}

export function categoryColor(name: string | null | undefined): string {
  if (!name) return UNCATEGORIZED_COLOR;
  const key = normalizeName(name);
  return KNOWN_CATEGORY_COLORS[key] ?? FALLBACK_PALETTE[hashString(key) % FALLBACK_PALETTE.length];
}

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("")}`;
}

/** Mescola un colore con un altro: `amount` 0 = il colore, 1 = l'altro. */
export function mixColor(hex: string, other: string, amount: number): string {
  // Un colore che non è un esadecimale (es. `var(--brand)`, il colore di un fascicolo senza categoria) non si può
  // calcolare qui: lo mescola il browser.
  if (!hex.startsWith("#")) return `color-mix(in srgb, ${hex} ${Math.round((1 - amount) * 100)}%, ${other})`;
  const [r1, g1, b1] = hexToRgb(hex);
  const [r2, g2, b2] = hexToRgb(other);
  return rgbToHex(r1 + (r2 - r1) * amount, g1 + (g2 - g1) * amount, b1 + (b2 - b1) * amount);
}

// ---------------------------------------------------------------------------------------------------------------
// Scadenze e lettura
// ---------------------------------------------------------------------------------------------------------------

export type ExpiryLevel = "overdue" | "danger" | "warn" | "soft" | "none";

export interface ExpiryInfo {
  level: ExpiryLevel;
  /** Giorni alla scadenza: negativo se già scaduta. null senza scadenza. */
  days: number | null;
  /** "scade tra 9 giorni", "scade tra 5 mesi", "scaduto da 3 giorni" --- vuoto senza scadenza. */
  text: string;
}

/** Una data senza orario (`2027-03-15`) è un giorno del calendario locale, non la mezzanotte UTC: altrimenti cambierebbe giorno a seconda del fuso. */
export function parseIsoDate(iso: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return match ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])) : new Date(iso);
}

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

function daysBetween(from: Date, to: Date): number {
  return Math.round((startOfDay(to) - startOfDay(from)) / DAY_MS);
}

function pluralize(n: number, one: string, many: string): string {
  return n === 1 ? `${n} ${one}` : `${n} ${many}`;
}

/** `soft` oltre i due mesi: una scadenza lontana si mostra, ma non chiede attenzione. */
export function expiryInfo(expiresAt: string | null, now: Date): ExpiryInfo {
  if (!expiresAt) return { level: "none", days: null, text: "" };
  const days = daysBetween(now, parseIsoDate(expiresAt));
  if (days < 0) return { level: "overdue", days, text: `scaduto da ${pluralize(-days, "giorno", "giorni")}` };
  if (days === 0) return { level: "danger", days, text: "scade oggi" };
  if (days <= 14) return { level: "danger", days, text: `scade tra ${pluralize(days, "giorno", "giorni")}` };
  if (days <= 60) return { level: "warn", days, text: `scade tra ${days} giorni` };
  const months = Math.round(days / 30);
  if (months < 24) return { level: "soft", days, text: `scade tra ${months} mesi` };
  return { level: "soft", days, text: `scade tra ${Math.round(months / 12)} anni` };
}

/**
 * Quanto manca a una scadenza, come si dice a voce: "oggi", "domani", "fra 19 giorni", "fra 5 mesi", "da 3 giorni" se è passata.
 * Il livello segue le stesse soglie di `expiryInfo` (urgente entro 14 giorni, da tenere d'occhio entro 60), così una scadenza
 * ha lo stesso colore in Oggi, in Scadenze e nei documenti.
 */
export function dueIn(iso: string, now: Date): { level: ExpiryLevel; days: number; text: string } {
  const days = daysBetween(now, parseIsoDate(iso));
  if (days < 0) return { level: "overdue", days, text: `scaduta da ${pluralize(-days, "giorno", "giorni")}` };
  if (days === 0) return { level: "danger", days, text: "oggi" };
  if (days === 1) return { level: "danger", days, text: "domani" };
  if (days <= 14) return { level: "danger", days, text: `fra ${days} giorni` };
  if (days <= 60) return { level: "warn", days, text: `fra ${days} giorni` };
  const months = Math.round(days / 30);
  if (months < 24) return { level: "soft", days, text: `fra ${months} mesi` };
  return { level: "soft", days, text: `fra ${Math.round(months / 12)} anni` };
}

/** Chiede attenzione: già scaduta, o in scadenza entro due mesi. */
export function needsAttention(info: ExpiryInfo): boolean {
  return info.level === "overdue" || info.level === "danger" || info.level === "warn";
}

// ---------------------------------------------------------------------------------------------------------------
// Date leggibili
// ---------------------------------------------------------------------------------------------------------------

const MONTHS_SHORT = ["gen", "feb", "mar", "apr", "mag", "giu", "lug", "ago", "set", "ott", "nov", "dic"];

/** "6 ott 2026" */
export function formatDayMonthYear(iso: string): string {
  const d = parseIsoDate(iso);
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`;
}

/** "oggi", "ieri", "5 giorni fa", poi la data: per "ultimo aggiunto". */
export function relativeDay(iso: string, now: Date): string {
  const days = daysBetween(new Date(iso), now);
  if (days <= 0) return "oggi";
  if (days === 1) return "ieri";
  if (days < 30) return `${days} giorni fa`;
  const d = new Date(iso);
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
}

// ---------------------------------------------------------------------------------------------------------------
// Ricerca
// ---------------------------------------------------------------------------------------------------------------

/** Il testo su cui si cerca: nome, emittente, note, campi della Scheda (targa, numero polizza...), categoria e bene. */
function searchableText(
  doc: DocumentSummary,
  categories: Pick<Category, "id" | "name">[],
  assets: Pick<AssetListItem, "id" | "name">[],
): string {
  const category = categories.find((c) => c.id === doc.categoryId)?.name ?? "";
  const asset = assets.find((a) => a.id === doc.relatedAssetId)?.name ?? "";
  return [doc.filename, doc.issuer, doc.notes, Object.values(doc.structuredFields).join(" "), category, asset]
    .join(" ")
    .toLowerCase();
}

export function matchesQuery(
  doc: DocumentSummary,
  query: string,
  categories: Pick<Category, "id" | "name">[],
  assets: Pick<AssetListItem, "id" | "name">[],
): boolean {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const text = searchableText(doc, categories, assets);
  return words.every((w) => text.includes(w));
}
