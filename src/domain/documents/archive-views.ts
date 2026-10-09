import { contentKindFor, CONTENT_KIND_LABEL, type ContentKind } from "@/lib/content-kind";
import type { Category } from "@/domain/categories/types";
import type { AssetListItem } from "@/domain/assets/types";
import type { DocumentSummary } from "@/domain/documents/types";

/**
 * La parte pura delle viste alternative dell'Archivio (cassettiera, linea del tempo, collezioni, scaffale): colori
 * delle categorie, urgenza delle scadenze, ricerca, raggruppamenti per mese e per categoria, disposizione dello
 * scaffale. Nessuna rete e nessun database: lavora sui riassunti dei documenti già decifrati in pagina.
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
export const UNCATEGORIZED_NAME = "Senza categoria";

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
  const [r1, g1, b1] = hexToRgb(hex);
  const [r2, g2, b2] = hexToRgb(other);
  return rgbToHex(r1 + (r2 - r1) * amount, g1 + (g2 - g1) * amount, b1 + (b2 - b1) * amount);
}

/** Lo sfondo chiaro di una collezione: il colore della categoria molto diluito nel bianco. */
export function categoryTint(name: string | null | undefined): string {
  return mixColor(categoryColor(name), "#ffffff", 0.9);
}

/** Il secondo colore di un dorso dello scaffale: la categoria, un po' più scura. */
export function categoryShade(name: string | null | undefined): string {
  return mixColor(categoryColor(name), "#000000", 0.2);
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

/** Chiede attenzione: già scaduta, o in scadenza entro due mesi. */
export function needsAttention(info: ExpiryInfo): boolean {
  return info.level === "overdue" || info.level === "danger" || info.level === "warn";
}

/** Hinthia ha letto il documento (anche solo in parte): una lettura esiste. */
export function isReadByHinthia(doc: Pick<DocumentSummary, "analysisStatus">): boolean {
  return doc.analysisStatus === "completed" || doc.analysisStatus === "partial";
}

// ---------------------------------------------------------------------------------------------------------------
// Date leggibili
// ---------------------------------------------------------------------------------------------------------------

const MONTHS_LONG = ["Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno", "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"];
const MONTHS_SHORT = ["gen", "feb", "mar", "apr", "mag", "giu", "lug", "ago", "set", "ott", "nov", "dic"];

export function monthLong(index: number): string {
  return MONTHS_LONG[index];
}

function monthShort(index: number): string {
  return MONTHS_SHORT[index];
}

/** "6 ott" */
export function formatDayMonth(iso: string): string {
  const d = parseIsoDate(iso);
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
}

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
// Ricerca, filtri, conteggi
// ---------------------------------------------------------------------------------------------------------------

export type ArchiveViewPreset = "all" | "expiring" | "unread" | "uncategorized" | "recent" | "duplicates";

/** Il testo su cui si cerca: nome, emittente, note, tag, campi della Scheda (targa, numero polizza...), categoria e bene. */
function searchableText(
  doc: DocumentSummary,
  categories: Pick<Category, "id" | "name">[],
  assets: Pick<AssetListItem, "id" | "name">[],
): string {
  const category = categories.find((c) => c.id === doc.categoryId)?.name ?? "";
  const asset = assets.find((a) => a.id === doc.relatedAssetId)?.name ?? "";
  return [doc.filename, doc.issuer, doc.notes, doc.tags.join(" "), Object.values(doc.structuredFields).join(" "), category, asset]
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

/** Documenti con lo stesso nome e la stessa dimensione: quasi certamente lo stesso file caricato due volte. */
export function duplicateIds(docs: DocumentSummary[]): Set<string> {
  const groups = new Map<string, string[]>();
  for (const doc of docs) {
    const key = `${normalizeName(doc.filename)}|${doc.size}`;
    groups.set(key, [...(groups.get(key) ?? []), doc.id]);
  }
  const result = new Set<string>();
  for (const ids of groups.values()) if (ids.length > 1) ids.forEach((id) => result.add(id));
  return result;
}

export function matchesPreset(
  doc: DocumentSummary,
  preset: ArchiveViewPreset,
  now: Date,
  duplicates: Set<string>,
): boolean {
  switch (preset) {
    case "expiring":
      return needsAttention(expiryInfo(doc.expiresAt, now));
    case "unread":
      return !isReadByHinthia(doc);
    case "uncategorized":
      return doc.categoryId === null;
    case "recent":
      return daysBetween(new Date(doc.createdAt), now) <= 30;
    case "duplicates":
      return duplicates.has(doc.id);
    default:
      return true;
  }
}

export interface ArchiveCounts {
  total: number;
  expiring: number;
  unread: number;
  uncategorized: number;
  recent: number;
  duplicates: number;
}

export function countPresets(docs: DocumentSummary[], now: Date): ArchiveCounts {
  const duplicates = duplicateIds(docs);
  const counts: ArchiveCounts = { total: docs.length, expiring: 0, unread: 0, uncategorized: 0, recent: 0, duplicates: duplicates.size };
  for (const doc of docs) {
    if (matchesPreset(doc, "expiring", now, duplicates)) counts.expiring += 1;
    if (matchesPreset(doc, "unread", now, duplicates)) counts.unread += 1;
    if (matchesPreset(doc, "uncategorized", now, duplicates)) counts.uncategorized += 1;
    if (matchesPreset(doc, "recent", now, duplicates)) counts.recent += 1;
  }
  return counts;
}

export interface FacetEntry {
  key: string;
  label: string;
  count: number;
}

/** Quante volte compare ogni categoria, dalla più usata; "Senza categoria" in fondo se c'è. */
export function categoryFacets(docs: DocumentSummary[], categories: Category[]): FacetEntry[] {
  const counts = new Map<string | null, number>();
  for (const doc of docs) counts.set(doc.categoryId, (counts.get(doc.categoryId) ?? 0) + 1);
  const entries: FacetEntry[] = categories
    .filter((c) => counts.has(c.id))
    .map((c) => ({ key: c.id, label: c.name, count: counts.get(c.id) ?? 0 }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  const none = counts.get(null);
  if (none) entries.push({ key: "", label: UNCATEGORIZED_NAME, count: none });
  return entries;
}

export function kindFacets(docs: DocumentSummary[]): (FacetEntry & { kind: ContentKind })[] {
  const counts = new Map<ContentKind, number>();
  for (const doc of docs) {
    const kind = contentKindFor(doc.mimeType);
    counts.set(kind, (counts.get(kind) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([kind, count]) => ({ key: kind, kind, label: CONTENT_KIND_LABEL[kind], count }))
    .sort((a, b) => b.count - a.count);
}

export function yearFacets(docs: DocumentSummary[]): FacetEntry[] {
  const counts = new Map<number, number>();
  for (const doc of docs) {
    const year = new Date(doc.createdAt).getFullYear();
    counts.set(year, (counts.get(year) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([year, count]) => ({ key: String(year), label: String(year), count }));
}

export function sortByNewest(docs: DocumentSummary[]): DocumentSummary[] {
  return [...docs].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

// ---------------------------------------------------------------------------------------------------------------
// Linea del tempo
// ---------------------------------------------------------------------------------------------------------------

export interface MonthGroup {
  /** `2026-10` */
  key: string;
  year: number;
  /** 0-11 */
  month: number;
  label: string;
  short: string;
  count: number;
  /** Dal più recente. */
  docs: DocumentSummary[];
}

function monthKeyOf(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** I documenti raggruppati per mese di aggiunta, dal mese più recente. */
export function groupByMonth(docs: DocumentSummary[]): MonthGroup[] {
  const groups = new Map<string, MonthGroup>();
  for (const doc of sortByNewest(docs)) {
    const key = monthKeyOf(doc.createdAt);
    let group = groups.get(key);
    if (!group) {
      const d = new Date(doc.createdAt);
      group = {
        key,
        year: d.getFullYear(),
        month: d.getMonth(),
        label: `${monthLong(d.getMonth())} ${d.getFullYear()}`,
        short: monthShort(d.getMonth()).replace(/^./, (c) => c.toUpperCase()),
        count: 0,
        docs: [],
      };
      groups.set(key, group);
    }
    group.docs.push(doc);
    group.count += 1;
  }
  return [...groups.values()];
}

/** Le scadenze più vicine, dalla più urgente (le già scadute per prime): per il blocco "In arrivo". */
export function upcomingExpiries(docs: DocumentSummary[], now: Date, withinDays = 60) {
  return docs
    .map((doc) => ({ doc, info: expiryInfo(doc.expiresAt, now) }))
    .filter(({ info }) => info.days !== null && info.days <= withinDays)
    .sort((a, b) => (a.info.days ?? 0) - (b.info.days ?? 0));
}

// ---------------------------------------------------------------------------------------------------------------
// Collezioni
// ---------------------------------------------------------------------------------------------------------------

export interface Collection {
  /** Id della categoria, "" per "Senza categoria". */
  id: string;
  name: string;
  color: string;
  count: number;
  /** Quanti hanno una scadenza che chiede attenzione. */
  soon: number;
  /** ISO dell'ultimo aggiunto. */
  lastAdded: string;
}

export function buildCollections(docs: DocumentSummary[], categories: Category[], now: Date): Collection[] {
  const byCategory = new Map<string, DocumentSummary[]>();
  for (const doc of docs) {
    const key = doc.categoryId ?? "";
    byCategory.set(key, [...(byCategory.get(key) ?? []), doc]);
  }
  const result: Collection[] = [];
  for (const [id, list] of byCategory) {
    const category = categories.find((c) => c.id === id);
    if (id !== "" && !category) continue;
    const name = category?.name ?? UNCATEGORIZED_NAME;
    result.push({
      id,
      name,
      color: category ? categoryColor(name) : UNCATEGORIZED_COLOR,
      count: list.length,
      soon: list.filter((d) => needsAttention(expiryInfo(d.expiresAt, now))).length,
      lastAdded: list.reduce((latest, d) => (d.createdAt > latest ? d.createdAt : latest), list[0].createdAt),
    });
  }
  return result.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

// ---------------------------------------------------------------------------------------------------------------
// Scaffale
// ---------------------------------------------------------------------------------------------------------------

export const SHELF_COLUMNS = 42;
const SHELF_ROWS = 4;
const SPINE_MIN_HEIGHT = 96;
const SPINE_MAX_HEIGHT = 152;

export interface Spine {
  doc: DocumentSummary;
  /** Larghezza in colonne (1 o 2). */
  span: 1 | 2;
  /** Altezza in px: più grande il file, più alto il dorso. */
  height: number;
}

export interface Shelf {
  label: string;
  spines: Spine[];
}

/** 96–152 px su scala logaritmica dalla dimensione: un PDF di 40 KB e uno di 40 MB non stanno sulla stessa retta. */
export function spineHeight(size: number): number {
  const minLog = Math.log10(10 * 1024);
  const maxLog = Math.log10(30 * 1024 * 1024);
  const t = Math.max(0, Math.min(1, (Math.log10(Math.max(size, 1)) - minLog) / (maxLog - minLog)));
  return Math.round(SPINE_MIN_HEIGHT + t * (SPINE_MAX_HEIGHT - SPINE_MIN_HEIGHT));
}

/** "set–ott 2026", "dic 2025–feb 2026", "ott 2026" */
export function shelfLabel(docs: DocumentSummary[]): string {
  if (docs.length === 0) return "";
  const dates = docs.map((d) => new Date(d.createdAt)).sort((a, b) => a.getTime() - b.getTime());
  const first = dates[0];
  const last = dates[dates.length - 1];
  const fm = monthShort(first.getMonth());
  const lm = monthShort(last.getMonth());
  if (first.getFullYear() === last.getFullYear()) {
    return fm === lm ? `${fm} ${first.getFullYear()}` : `${fm}–${lm} ${first.getFullYear()}`;
  }
  return `${fm} ${first.getFullYear()}–${lm} ${last.getFullYear()}`;
}

/**
 * I documenti più recenti sullo scaffale: file per file, un dorso ciascuno, 42 colonne per ripiano, 4 ripiani. Un file tra
 * i più grandi (un quinto) è un dorso largo il doppio. Se rimane una colonna sola, il dorso largo diventa stretto.
 */
export function layoutShelf(docs: DocumentSummary[], columns = SHELF_COLUMNS, rows = SHELF_ROWS): Shelf[] {
  const newest = sortByNewest(docs).slice(0, columns * rows);
  if (newest.length === 0) return [];
  const sizes = [...newest.map((d) => d.size)].sort((a, b) => a - b);
  const wideFrom = sizes[Math.floor(sizes.length * 0.8)] ?? Infinity;

  const shelves: Shelf[] = [];
  let spines: Spine[] = [];
  let used = 0;
  for (const doc of newest) {
    if (shelves.length >= rows) break; // i dorsi larghi riempiono i ripiani prima: gli ultimi documenti restano fuori
    const wide = newest.length > 4 && doc.size >= wideFrom && doc.size > sizes[0];
    const span: 1 | 2 = wide && used < columns - 1 ? 2 : 1;
    spines.push({ doc, span, height: spineHeight(doc.size) });
    used += span;
    if (used >= columns) {
      shelves.push({ label: shelfLabel(spines.map((s) => s.doc)), spines });
      spines = [];
      used = 0;
    }
  }
  if (spines.length > 0) shelves.push({ label: shelfLabel(spines.map((s) => s.doc)), spines });
  return shelves;
}
