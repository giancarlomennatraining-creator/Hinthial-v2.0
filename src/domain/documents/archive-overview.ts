import type { Category } from "@/domain/categories/types";
import type { DocumentSummary } from "@/domain/documents/types";
import { categoryColor, expiryInfo, needsAttention, type ExpiryInfo } from "@/domain/documents/archive-views";

/**
 * La parte pura delle viste dell'Archivio (Panoramica, Schede, Elenco): cosa chiede attenzione, i più recenti, i riquadri
 * per categoria, l'ordinamento e il raggruppamento per mese. Lavora sui riassunti già decifrati in pagina, senza rete.
 */

export type ArchiveView = "panoramica" | "schede" | "elenco";

export const ARCHIVE_VIEW_STORAGE_KEY = "hinthial-archive-view";

/** La vista salvata sul dispositivo; senza (o con un valore sconosciuto) si parte dalla Panoramica. */
export function parseArchiveView(raw: string | null | undefined): ArchiveView {
  return raw === "schede" || raw === "elenco" || raw === "panoramica" ? raw : "panoramica";
}

export type ArchiveSort = "recenti" | "scadenza" | "nome";

/** Il valore del filtro per i contenuti senza categoria (il filtro normale è l'id di una categoria, o vuoto per tutti). */
export const NO_CATEGORY = "none";

export function filterByCategory(documents: DocumentSummary[], value: string): DocumentSummary[] {
  if (!value) return documents;
  if (value === NO_CATEGORY) return documents.filter((d) => d.categoryId === null);
  return documents.filter((d) => d.categoryId === value);
}

/** Una copia ordinata: i più recenti per primi; per scadenza, prima chi scade (la più vicina in testa), poi gli altri per data; per nome, alfabetico senza badare alle maiuscole. */
export function sortDocuments(documents: DocumentSummary[], sort: ArchiveSort): DocumentSummary[] {
  const byRecent = (a: DocumentSummary, b: DocumentSummary) => b.createdAt.localeCompare(a.createdAt);
  const copy = [...documents];
  if (sort === "nome") return copy.sort((a, b) => a.filename.localeCompare(b.filename, "it", { sensitivity: "base" }));
  if (sort === "scadenza") {
    return copy.sort((a, b) => {
      if (a.expiresAt && b.expiresAt) return a.expiresAt.localeCompare(b.expiresAt);
      if (a.expiresAt) return -1;
      if (b.expiresAt) return 1;
      return byRecent(a, b);
    });
  }
  return copy.sort(byRecent);
}

const MONTHS_LONG = [
  "gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno",
  "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre",
];

export interface MonthGroup {
  key: string;
  /** "ottobre 2026" */
  label: string;
  documents: DocumentSummary[];
}

/** Raggruppa per mese di aggiunta, mantenendo l'ordine ricevuto (pensato per l'elenco già ordinato dai più recenti). */
export function groupByMonth(documents: DocumentSummary[]): MonthGroup[] {
  const groups: MonthGroup[] = [];
  for (const doc of documents) {
    const d = new Date(doc.createdAt);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const last = groups[groups.length - 1];
    if (last && last.key === key) last.documents.push(doc);
    else groups.push({ key, label: `${MONTHS_LONG[d.getMonth()]} ${d.getFullYear()}`, documents: [doc] });
  }
  return groups;
}

export interface ExpiringItem {
  doc: DocumentSummary;
  info: ExpiryInfo;
}

export interface Attention {
  /** Le scadenze che chiedono attenzione (scadute o entro due mesi), la più urgente per prima. */
  expiring: ExpiringItem[];
  /** Quante sono in tutto: `expiring` ne mostra solo alcune. */
  expiringTotal: number;
  uncategorized: number;
}

export function attentionFor(documents: DocumentSummary[], now: Date, limit = 3): Attention {
  const all: ExpiringItem[] = [];
  for (const doc of documents) {
    const info = expiryInfo(doc.expiresAt, now);
    if (needsAttention(info)) all.push({ doc, info });
  }
  all.sort((a, b) => (a.info.days ?? 0) - (b.info.days ?? 0));
  return {
    expiring: all.slice(0, limit),
    expiringTotal: all.length,
    uncategorized: documents.filter((d) => d.categoryId === null).length,
  };
}

export interface CategoryTile {
  /** `null` per "Senza categoria". */
  id: string | null;
  name: string;
  icon: string;
  color: string;
  count: number;
  /** La data di aggiunta dell'ultimo contenuto. */
  lastAt: string;
}

function latest(documents: DocumentSummary[]): string {
  return documents.reduce((last, d) => (d.createdAt > last ? d.createdAt : last), documents[0].createdAt);
}

/** Un riquadro per ogni categoria che ha contenuti, le più piene per prime; "Senza categoria" in coda, se ce ne sono. */
export function categoryTiles(documents: DocumentSummary[], categories: Category[]): CategoryTile[] {
  const tiles: CategoryTile[] = [];
  for (const category of categories) {
    const own = documents.filter((d) => d.categoryId === category.id);
    if (own.length === 0) continue;
    tiles.push({
      id: category.id,
      name: category.name,
      icon: category.icon,
      color: categoryColor(category.name),
      count: own.length,
      lastAt: latest(own),
    });
  }
  tiles.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "it"));
  const loose = documents.filter((d) => d.categoryId === null);
  if (loose.length > 0) {
    tiles.push({
      id: null,
      name: "Senza categoria",
      icon: "🗂️",
      color: categoryColor(null),
      count: loose.length,
      lastAt: latest(loose),
    });
  }
  return tiles;
}
