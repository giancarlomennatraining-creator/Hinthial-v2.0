import type {
  AIAnswer,
  AIContext,
  AIProvider,
  AISource,
  AISuggestion,
} from "@/domain/ai/types";
import { AI_SOURCE_KIND_LABELS } from "@/domain/ai/labels";

/**
 * FASE 10 --- provider mock: nessun modello linguistico, solo
 * corrispondenze dichiaratamente semplici per parole chiave e
 * attraversamento delle relazioni già presenti nei dati (asset <->
 * documenti/scadenze, categoria -> tutto ciò che contiene, capsula ->
 * destinatari/documenti). Dimostra la forma dell'interfaccia AIProvider
 * in vista di un provider reale (FASE 11) --- non finge di capire il
 * linguaggio naturale.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

function tokenize(query: string): string[] {
  return query
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((token) => token.length >= 3);
}

function textMatches(text: string, tokens: string[]): boolean {
  const normalized = text.toLowerCase();
  return tokens.some((token) => normalized.includes(token));
}

function dedupeSources(sources: AISource[]): AISource[] {
  const seen = new Set<string>();
  const result: AISource[] = [];
  for (const source of sources) {
    const key = `${source.kind}:${source.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(source);
  }
  return result;
}

function search(query: string, context: AIContext): AISource[] {
  const tokens = tokenize(query);
  if (tokens.length === 0) return [];

  // Le categorie non hanno una pagina propria da linkare, quindi non
  // diventano mai una fonte a sé --- ma un nome di categoria citato
  // nella domanda conta comunque: retrieve() lo usa per allargare a
  // tutto ciò che è in quella categoria (v. matchedCategoryIds sotto).
  const sources: AISource[] = [];

  for (const asset of context.assets) {
    if (textMatches(asset.name, tokens)) {
      sources.push({ kind: "asset", id: asset.id, label: asset.name, href: "/assets" });
    }
  }

  for (const doc of context.documents) {
    const haystack = [doc.filename, doc.notes, doc.transcript, ...doc.tags].join(" ");
    if (textMatches(haystack, tokens)) {
      sources.push({ kind: "document", id: doc.id, label: doc.filename, href: "/archive" });
    }
  }

  for (const reminder of context.reminders) {
    if (textMatches(reminder.title, tokens)) {
      sources.push({ kind: "reminder", id: reminder.id, label: reminder.title, href: "/reminders" });
    }
  }

  for (const contact of context.contacts) {
    if (textMatches([contact.name, contact.email, contact.role].join(" "), tokens)) {
      sources.push({ kind: "contact", id: contact.id, label: contact.name, href: "/contacts" });
    }
  }

  for (const capsule of context.capsules) {
    const attachmentTranscripts = capsule.attachments.map((a) => a.transcript ?? "");
    const haystack = [capsule.title, capsule.content, ...attachmentTranscripts].join(" ");
    if (textMatches(haystack, tokens)) {
      sources.push({ kind: "capsule", id: capsule.id, label: capsule.title, href: "/capsules" });
    }
  }

  return dedupeSources(sources);
}

function matchedCategoryIds(query: string, context: AIContext): Set<string> {
  const tokens = tokenize(query);
  return new Set(
    context.categories.filter((c) => textMatches(c.name, tokens)).map((c) => c.id),
  );
}

/** Parole che nominano un intero tipo di entità (singolare e plurale) --- "quanti CONTATTI ho?", "quali DOCUMENTI ho?". */
const LIST_ALL_TRIGGERS: Record<string, AISource["kind"]> = {
  asset: "asset",
  documento: "document",
  documenti: "document",
  scadenza: "reminder",
  scadenze: "reminder",
  contatto: "contact",
  contatti: "contact",
  capsula: "capsule",
  capsule: "capsule",
};

/** Se la domanda nomina un tipo di entità per intero (non un elemento specifico), l'intento è "elencameli tutti". */
function detectListAllKind(query: string): AISource["kind"] | null {
  for (const token of tokenize(query)) {
    const kind = LIST_ALL_TRIGGERS[token];
    if (kind) return kind;
  }
  return null;
}

function allSourcesOfKind(kind: AISource["kind"], context: AIContext): AISource[] {
  switch (kind) {
    case "asset":
      return context.assets.map((a) => ({ kind: "asset", id: a.id, label: a.name, href: "/assets" }));
    case "document":
      return context.documents.map((d) => ({ kind: "document", id: d.id, label: d.filename, href: "/archive" }));
    case "reminder":
      return context.reminders.map((r) => ({ kind: "reminder", id: r.id, label: r.title, href: "/reminders" }));
    case "contact":
      return context.contacts.map((c) => ({ kind: "contact", id: c.id, label: c.name, href: "/contacts" }));
    case "capsule":
      return context.capsules.map((c) => ({ kind: "capsule", id: c.id, label: c.title, href: "/capsules" }));
  }
}

function retrieve(query: string, context: AIContext): AISource[] {
  const direct = search(query, context);
  const categoryIds = matchedCategoryIds(query, context);
  const sources = [...direct];

  // Una categoria citata nella domanda porta con sé tutto ciò che le
  // appartiene, anche se il nome del singolo asset/documento non
  // contiene la parola --- è il caso "Quali assicurazioni ho?" del
  // piano: "assicurazioni" è il nome della categoria, non degli asset.
  if (categoryIds.size > 0) {
    for (const asset of context.assets) {
      if (asset.categoryId && categoryIds.has(asset.categoryId)) {
        sources.push({ kind: "asset", id: asset.id, label: asset.name, href: "/assets" });
      }
    }
    for (const doc of context.documents) {
      if (doc.categoryId && categoryIds.has(doc.categoryId)) {
        sources.push({ kind: "document", id: doc.id, label: doc.filename, href: "/archive" });
      }
    }
  }

  // Ogni asset trovato porta con sé i documenti e le scadenze collegati.
  const matchedAssetIds = new Set(sources.filter((s) => s.kind === "asset").map((s) => s.id));
  for (const assetId of matchedAssetIds) {
    for (const doc of context.documents) {
      if (doc.relatedAssetId === assetId) {
        sources.push({ kind: "document", id: doc.id, label: doc.filename, href: "/archive" });
      }
    }
    for (const reminder of context.reminders) {
      if (reminder.relatedAssetId === assetId) {
        sources.push({ kind: "reminder", id: reminder.id, label: reminder.title, href: "/reminders" });
      }
    }
  }

  // Ogni documento trovato porta con sé l'asset a cui è collegato.
  const matchedDocumentIds = new Set(sources.filter((s) => s.kind === "document").map((s) => s.id));
  for (const documentId of matchedDocumentIds) {
    const doc = context.documents.find((d) => d.id === documentId);
    const asset = doc?.relatedAssetId && context.assets.find((a) => a.id === doc.relatedAssetId);
    if (asset) sources.push({ kind: "asset", id: asset.id, label: asset.name, href: "/assets" });
  }

  // Ogni capsula trovata porta con sé i suoi destinatari e i documenti collegati.
  const matchedCapsuleIds = new Set(sources.filter((s) => s.kind === "capsule").map((s) => s.id));
  for (const capsuleId of matchedCapsuleIds) {
    const capsule = context.capsules.find((c) => c.id === capsuleId);
    if (!capsule) continue;
    for (const contact of capsule.relatedContacts) {
      sources.push({ kind: "contact", id: contact.id, label: contact.name, href: "/contacts" });
    }
    for (const doc of capsule.linkedDocuments) {
      sources.push({ kind: "document", id: doc.id, label: doc.filename, href: "/archive" });
    }
  }

  const specific = dedupeSources(sources);
  if (specific.length > 0) return specific;

  // Nulla di specifico trovato --- se la domanda nomina comunque un
  // intero tipo di entità ("quanti contatti ho?"), l'interpretazione più
  // ragionevole è "elencameli tutti", non "niente trovato". Un
  // ripiego, non la prima interpretazione: "quali documenti riguardano
  // la casa?" deve restare filtrato a quelli su "casa" (v. sopra), non
  // diventare l'elenco di ogni documento solo perché contiene la parola
  // "documenti".
  const listAllKind = detectListAllKind(query);
  return listAllKind ? allSourcesOfKind(listAllKind, context) : [];
}

function answer(query: string, context: AIContext): AIAnswer {
  const sources = retrieve(query, context);

  if (sources.length === 0) {
    return {
      text: `Non ho trovato nulla di collegato a "${query}" nei tuoi dati.`,
      sources: [],
    };
  }

  const byKind = new Map<AISource["kind"], AISource[]>();
  for (const source of sources) {
    const group = byKind.get(source.kind) ?? [];
    group.push(source);
    byKind.set(source.kind, group);
  }

  const lines = [...byKind.entries()].map(
    ([kind, items]) => `${AI_SOURCE_KIND_LABELS[kind]}: ${items.map((s) => s.label).join(", ")}`,
  );

  return {
    text: `Ho trovato questo, collegato a "${query}":\n\n${lines.join("\n")}`,
    sources,
  };
}

function suggest(context: AIContext): AISuggestion[] {
  const suggestions: AISuggestion[] = [];
  const now = Date.now();

  const overdue = context.reminders.filter((r) => !r.completed && new Date(r.dueAt).getTime() < now);
  if (overdue.length > 0) {
    suggestions.push({
      text: `Hai ${overdue.length} ${overdue.length === 1 ? "scadenza scaduta" : "scadenze scadute"}: ${overdue.map((r) => r.title).join(", ")}.`,
      sources: overdue.map((r) => ({ kind: "reminder", id: r.id, label: r.title, href: "/reminders" })),
    });
  }

  const soon = context.reminders.filter((r) => {
    if (r.completed) return false;
    const daysLeft = (new Date(r.dueAt).getTime() - now) / DAY_MS;
    return daysLeft >= 0 && daysLeft <= 7;
  });
  if (soon.length > 0) {
    suggestions.push({
      text: `${soon.length === 1 ? "Questa scadenza è" : "Queste scadenze sono"} nei prossimi 7 giorni: ${soon.map((r) => r.title).join(", ")}.`,
      sources: soon.map((r) => ({ kind: "reminder", id: r.id, label: r.title, href: "/reminders" })),
    });
  }

  const assetsWithoutDocuments = context.assets.filter(
    (asset) => !context.documents.some((doc) => doc.relatedAssetId === asset.id),
  );
  if (assetsWithoutDocuments.length > 0) {
    suggestions.push({
      text: `${assetsWithoutDocuments.length === 1 ? "Questo asset non ha" : "Questi asset non hanno"} ancora documenti collegati: ${assetsWithoutDocuments.map((a) => a.name).join(", ")}.`,
      sources: assetsWithoutDocuments.map((a) => ({ kind: "asset", id: a.id, label: a.name, href: "/assets" })),
    });
  }

  return suggestions;
}

export const mockAIProvider: AIProvider = { search, retrieve, answer, suggest };
