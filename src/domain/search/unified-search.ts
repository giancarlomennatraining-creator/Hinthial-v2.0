import type { AIContext, AISource } from "@/domain/ai/types";
import { findTextSnippet, flattenForSearch, type TextSnippet } from "@/lib/text-snippet";
import { formatDate } from "@/lib/format";

/**
 * Ricerca unificata (Ctrl/Cmd+K): tutto in memoria sul contesto già decifrato (v. domain/ai/context.ts), nessuna
 * query. Ogni parola digitata deve comparire da qualche parte nell'elemento (non basta una qualsiasi): "polizza
 * auto" trova la polizza dell'auto, non ogni cosa con "auto" o con "polizza".
 */

export type SearchArea = AISource["kind"];

export const SEARCH_AREAS: readonly SearchArea[] = ["document", "reminder", "asset", "friend", "capsule"];

/** Da dove viene il frammento mostrato sotto il risultato --- perché l'elemento è comparso se il nome non basta. */
export type SnippetOrigin = "text" | "notes" | "transcript" | "content";

export interface SearchResult {
  kind: SearchArea;
  id: string;
  label: string;
  href: string;
  /** Riga di contesto sotto il nome (categoria, scadenza, ruolo...); può essere vuota. */
  detail: string;
  snippet: TextSnippet | null;
  snippetOrigin: SnippetOrigin | null;
  /** Le parole sono nel nome (0), in etichette/dettagli (1), solo nel contenuto (2) --- ordina i risultati. */
  rank: 0 | 1 | 2;
}

function normalizeForSearch(text: string): string {
  return flattenForSearch(text)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

function searchTerms(query: string): string[] {
  return normalizeForSearch(query)
    .split(" ")
    .filter((term) => term.length > 0);
}

function includesAll(haystack: string, terms: string[]): boolean {
  return terms.every((term) => haystack.includes(term));
}

/** Nome, poi etichette/dettagli, poi contenuto: il primo livello in cui TUTTE le parole si trovano. */
function rankOf(
  terms: string[],
  name: string,
  labels: string,
  content: string,
): 0 | 1 | 2 | null {
  const n = normalizeForSearch(name);
  if (includesAll(n, terms)) return 0;
  const l = normalizeForSearch(`${name} ${labels}`);
  if (includesAll(l, terms)) return 1;
  const all = normalizeForSearch(`${name} ${labels} ${content}`);
  return includesAll(all, terms) ? 2 : null;
}

export function searchEverything(query: string, context: AIContext): SearchResult[] {
  const terms = searchTerms(query);
  if (terms.length === 0) return [];

  const categoryName = new Map(context.categories.map((c) => [c.id, c.name]));
  const results: SearchResult[] = [];

  for (const asset of context.assets) {
    const category = asset.categoryId ? (categoryName.get(asset.categoryId) ?? "") : "";
    const rank = rankOf(terms, asset.name, category, "");
    if (rank === null) continue;
    results.push({
      kind: "asset",
      id: asset.id,
      label: asset.name,
      href: "/assets",
      detail: category,
      snippet: null,
      snippetOrigin: null,
      rank,
    });
  }

  for (const doc of context.documents) {
    const category = doc.categoryId ? (categoryName.get(doc.categoryId) ?? "") : "";
    const labels = [category, doc.issuer, ...doc.tags].join(" ");
    const content = [doc.notes, doc.transcript, doc.extractedText].join(" ");
    const rank = rankOf(terms, doc.filename, labels, content);
    if (rank === null) continue;

    let snippet: TextSnippet | null = null;
    let snippetOrigin: SnippetOrigin | null = null;
    if (rank === 2) {
      const sources: Array<[SnippetOrigin, string]> = [
        ["text", doc.extractedText],
        ["notes", doc.notes],
        ["transcript", doc.transcript],
      ];
      for (const [origin, text] of sources) {
        const found = findTextSnippet(text, query);
        if (found) {
          snippet = found;
          snippetOrigin = origin;
          break;
        }
      }
    }

    const detail = [category, doc.expiresAt ? `scade ${formatDate(doc.expiresAt)}` : ""]
      .filter(Boolean)
      .join(" · ");
    results.push({
      kind: "document",
      id: doc.id,
      label: doc.filename,
      href: `/archive/${doc.id}`,
      detail,
      snippet,
      snippetOrigin,
      rank,
    });
  }

  for (const reminder of context.reminders) {
    const rank = rankOf(terms, reminder.title, [reminder.relatedAssetName, reminder.relatedDocumentFilename].join(" "), "");
    if (rank === null) continue;
    results.push({
      kind: "reminder",
      id: reminder.id,
      label: reminder.title,
      href: "/reminders",
      detail: formatDate(reminder.dueAt),
      snippet: null,
      snippetOrigin: null,
      rank,
    });
  }

  for (const friend of context.friends) {
    const rank = rankOf(terms, friend.name, [friend.email, friend.role].join(" "), "");
    if (rank === null) continue;
    results.push({
      kind: "friend",
      id: friend.id,
      label: friend.name,
      href: "/friends",
      detail: [friend.role, friend.email].filter(Boolean).join(" · "),
      snippet: null,
      snippetOrigin: null,
      rank,
    });
  }

  for (const capsule of context.capsules) {
    const transcripts = capsule.attachments.map((a) => a.transcript ?? "");
    const content = [capsule.content, ...transcripts].join(" ");
    const rank = rankOf(terms, capsule.title, "", content);
    if (rank === null) continue;

    let snippet: TextSnippet | null = null;
    let snippetOrigin: SnippetOrigin | null = null;
    if (rank === 2) {
      snippet = findTextSnippet(content, query);
      if (snippet) snippetOrigin = "content";
    }
    results.push({
      kind: "capsule",
      id: capsule.id,
      label: capsule.title,
      href: "/capsules",
      detail: capsule.openAt ? `si apre il ${formatDate(capsule.openAt)}` : "",
      snippet,
      snippetOrigin,
      rank,
    });
  }

  // Array.prototype.sort è stabile: a parità di rank resta l'ordine di arrivo dei dati.
  return results.sort((a, b) => a.rank - b.rank);
}

export function countByArea(results: SearchResult[]): Record<SearchArea, number> {
  const counts: Record<SearchArea, number> = { document: 0, reminder: 0, asset: 0, friend: 0, capsule: 0 };
  for (const result of results) counts[result.kind] += 1;
  return counts;
}
