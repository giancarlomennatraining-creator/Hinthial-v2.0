import type { AIAnswer, AIContext, AISource } from "@/domain/ai/types";
import { mockAIProvider } from "@/domain/ai/mock-provider";

/**
 * FASE 11 --- "Explicit AI processing" (v. HINTHIAL_MVP.md sezione 8):
 * a differenza di mockAIProvider, answerWithClaude() lascia il
 * dispositivo --- solo dopo il consenso esplicito dell'utente (v.
 * AIProcessingConsentProvider) e solo per questa singola domanda.
 *
 * Il retrieval resta locale e gratuito (mockAIProvider.retrieve(), già
 * corretto per la ricerca strutturata/testuale, v. HINTHIAL_MVP.md
 * FASE 11 "Retrieval"): decide QUALI elementi sono pertinenti prima che
 * un byte parta dal dispositivo. Solo quegli elementi --- non l'intero
 * vault --- vengono proiettati su pochi campi essenziali (v.
 * projectSource sotto) e inviati al provider esterno insieme alla
 * domanda, tramite src/app/api/ai/chat/route.ts (mai direttamente dal
 * browser: la chiave Anthropic resta lato server).
 */

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

/**
 * Riduce una fonte già trovata localmente al minimo che serve per
 * rispondere --- niente id interni, niente storage path, e per le
 * capsule mai il testo del messaggio (resta privato anche in questa
 * modalità: solo titolo/stato/data contano per rispondere a "quali
 * capsule ho" o "quando si apre").
 */
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
    case "contact": {
      const contact = context.contacts.find((c) => c.id === source.id);
      if (!contact) return null;
      return { kind: "contact", label: contact.name, detail: contact.role ? `ruolo: ${contact.role}` : undefined };
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

/**
 * Chiede una risposta reale a Claude, tramite la nostra route server-side
 * (mai una chiamata diretta dal browser). Lancia un errore --- gestito
 * dal chiamante --- se il consenso non è ancora stato dato lì, se la
 * chiave non è configurata, o se la richiesta di rete fallisce.
 */
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
    throw new Error(body?.error ?? "Impossibile contattare l'assistente AI.");
  }

  const data = await response.json();
  return { text: typeof data.text === "string" ? data.text : "", sources };
}
