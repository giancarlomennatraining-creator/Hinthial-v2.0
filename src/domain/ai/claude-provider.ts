import type { AIAnswer, AIContext, AISource } from "@/domain/ai/types";
import { mockAIProvider } from "@/domain/ai/mock-provider";

/** FASE 11: a differenza di mockAIProvider, lascia il dispositivo --- solo col consenso e solo gli elementi già filtrati in locale (mai l'intero vault, v. projectSource), via la route server-side. */

/** Un elemento pertinente ridotto ai soli campi utili a rispondere --- mai l'intero oggetto del vault. */
export interface MinimalItem {
  kind: AISource["kind"];
  label: string;
  detail?: string;
}

function categoryNameFor(categoryId: string | null, context: AIContext): string | null {
  if (!categoryId) return null;
  return context.categories.find((c) => c.id === categoryId)?.name ?? null;
}

/** Riduce una fonte al minimo utile a rispondere: niente id interni, e per le capsule mai il testo del messaggio. */
function projectSource(source: AISource, context: AIContext): MinimalItem | null {
  switch (source.kind) {
    case "asset": {
      const asset = context.assets.find((a) => a.id === source.id);
      if (!asset) return null;
      const category = categoryNameFor(asset.categoryId, context);
      return { kind: "asset", label: asset.name, detail: category ? `categoria: ${category}` : undefined };
    }
    case "document": {
      const doc = context.documents.find((d) => d.id === source.id);
      if (!doc) return null;
      const category = categoryNameFor(doc.categoryId, context);
      const parts = [
        category ? `categoria: ${category}` : null,
        doc.expiresAt ? `scade il: ${doc.expiresAt}` : null,
        doc.tags.length > 0 ? `tag: ${doc.tags.join(", ")}` : null,
      ].filter(Boolean);
      return { kind: "document", label: doc.filename, detail: parts.length > 0 ? parts.join("; ") : undefined };
    }
    case "reminder": {
      const reminder = context.reminders.find((r) => r.id === source.id);
      if (!reminder) return null;
      return {
        kind: "reminder",
        label: reminder.title,
        detail: `scadenza: ${reminder.dueAt}; ${reminder.completed ? "completata" : "non completata"}`,
      };
    }
    case "friend": {
      const friend = context.friends.find((c) => c.id === source.id);
      if (!friend) return null;
      return { kind: "friend", label: friend.name, detail: friend.role ? `ruolo: ${friend.role}` : undefined };
    }
    case "capsule": {
      const capsule = context.capsules.find((c) => c.id === source.id);
      if (!capsule) return null;
      return {
        kind: "capsule",
        label: capsule.title,
        detail: `stato: ${capsule.status}${capsule.openAt ? `; si apre il: ${capsule.openAt}` : ""}`,
      };
    }
  }
}

/** Chiede una risposta a Claude via la route server-side, mai dal browser. Lancia se manca consenso, chiave o la rete fallisce. */
export async function answerWithClaude(query: string, context: AIContext): Promise<AIAnswer> {
  const sources = mockAIProvider.retrieve(query, context);

  if (sources.length === 0) {
    return { text: `Non ho trovato nulla di collegato a "${query}" nei tuoi dati.`, sources: [] };
  }

  const items = sources
    .map((source) => projectSource(source, context))
    .filter((item): item is MinimalItem => item !== null);

  const response = await fetch("/api/ai/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, items }),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error ?? "Impossibile contattare Hinthia.");
  }

  const data = await response.json();
  return { text: typeof data.text === "string" ? data.text : "", sources };
}
