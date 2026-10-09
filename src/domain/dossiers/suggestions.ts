import type { DocumentSummary } from "@/domain/documents/types";
import type { DossierListItem } from "@/domain/dossiers/types";

/**
 * Fascicoli suggeriti: Hinthial nota cosa va insieme guardando i beni a cui sono collegati i documenti, e lo propone.
 * Solo regole prudenti: un collegamento sbagliato costa più di uno mancante, e ogni suggerimento si può rifiutare.
 * Puro e senza rete: il confronto avviene sul dispositivo, su dati già decifrati.
 */

/** Quanti documenti dello stesso bene, senza fascicolo, bastano a proporne uno nuovo. */
const MIN_DOCUMENTS_FOR_NEW_DOSSIER = 3;

/** Oltre questo numero, una scheda di suggerimenti diventa una lista da sbrigare: se ne mostrano di meno. */
const MAX_CANDIDATES = 5;

export interface DocumentCandidate {
  documentId: string;
  filename: string;
  createdAt: string;
  assetId: string;
  assetName: string;
}

export interface NewDossierSuggestion {
  assetId: string;
  /** Il nome proposto per il fascicolo: quello del bene. */
  title: string;
  documentIds: string[];
  /** Per mostrare di cosa si tratta, dal più recente. */
  filenames: string[];
}

/** Il bene più presente tra i documenti del fascicolo, se è uno solo: con un pareggio non si sceglie al posto dell'utente. */
function dominantAsset(documents: DocumentSummary[]): { id: string; count: number } | null {
  const counts = new Map<string, number>();
  for (const doc of documents) {
    if (doc.relatedAssetId) counts.set(doc.relatedAssetId, (counts.get(doc.relatedAssetId) ?? 0) + 1);
  }
  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  if (ranked.length === 0) return null;
  if (ranked.length > 1 && ranked[0][1] === ranked[1][1]) return null;
  return { id: ranked[0][0], count: ranked[0][1] };
}

/**
 * I documenti che forse appartengono a questo fascicolo: collegati allo stesso bene dei suoi documenti ma non dentro.
 * Servono almeno due documenti del fascicolo su quel bene (con uno solo il legame è troppo debole), e il bene deve
 * essere uno solo: un fascicolo che attraversa più beni non ne ha uno "suo".
 */
export function suggestDocumentsForDossier(input: {
  dossierId: string;
  documents: DocumentSummary[];
  assets: { id: string; name: string }[];
  dismissed: ReadonlySet<string>;
}): DocumentCandidate[] {
  const { dossierId, documents, assets, dismissed } = input;
  const inside = documents.filter((d) => d.dossierIds.includes(dossierId));
  const dominant = dominantAsset(inside);
  if (!dominant || dominant.count < 2) return [];

  const asset = assets.find((a) => a.id === dominant.id);
  if (!asset) return [];

  return documents
    .filter((d) => d.relatedAssetId === dominant.id && !d.dossierIds.includes(dossierId))
    .filter((d) => !dismissed.has(documentSuggestionKey(dossierId, d.id)))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, MAX_CANDIDATES)
    .map((d) => ({ documentId: d.id, filename: d.filename, createdAt: d.createdAt, assetId: asset.id, assetName: asset.name }));
}

function normalizeTitle(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Un fascicolo da creare: almeno tre documenti dello stesso bene, nessuno dei quali è già in un fascicolo. Se esiste
 * già un fascicolo con quel nome non si propone un doppione.
 */
export function suggestNewDossiers(input: {
  documents: DocumentSummary[];
  dossiers: Pick<DossierListItem, "title">[];
  assets: { id: string; name: string }[];
  dismissed: ReadonlySet<string>;
}): NewDossierSuggestion[] {
  const { documents, dossiers, assets, dismissed } = input;
  const existingTitles = new Set(dossiers.map((d) => normalizeTitle(d.title)));

  const byAsset = new Map<string, DocumentSummary[]>();
  for (const doc of documents) {
    if (!doc.relatedAssetId || doc.dossierIds.length > 0) continue;
    const group = byAsset.get(doc.relatedAssetId);
    if (group) group.push(doc);
    else byAsset.set(doc.relatedAssetId, [doc]);
  }

  const suggestions: NewDossierSuggestion[] = [];
  for (const [assetId, group] of byAsset) {
    if (group.length < MIN_DOCUMENTS_FOR_NEW_DOSSIER) continue;
    const asset = assets.find((a) => a.id === assetId);
    if (!asset || existingTitles.has(normalizeTitle(asset.name))) continue;
    if (dismissed.has(newSuggestionKey(assetId))) continue;
    const sorted = [...group].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    suggestions.push({
      assetId,
      title: asset.name,
      documentIds: sorted.map((d) => d.id),
      filenames: sorted.map((d) => d.filename),
    });
  }
  return suggestions.sort((a, b) => b.documentIds.length - a.documentIds.length);
}

// ---------------------------------------------------------------------------------------------------------------
// "Non ora": i suggerimenti rifiutati, ricordati sul dispositivo (nessun dato in più sul server).
// ---------------------------------------------------------------------------------------------------------------

export function documentSuggestionKey(dossierId: string, documentId: string): string {
  return `doc:${dossierId}:${documentId}`;
}

export function newSuggestionKey(assetId: string): string {
  return `new:${assetId}`;
}

const DISMISSED_STORAGE_KEY = "hinthial:dossier-suggestions-dismissed";

export function loadDismissedSuggestions(): Set<string> {
  try {
    const raw = window.localStorage.getItem(DISMISSED_STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : []);
  } catch {
    return new Set();
  }
}

export function saveDismissedSuggestions(keys: ReadonlySet<string>): void {
  try {
    window.localStorage.setItem(DISMISSED_STORAGE_KEY, JSON.stringify([...keys]));
  } catch {
    // Storage non disponibile: il suggerimento tornerà alla prossima visita, niente di grave.
  }
}
