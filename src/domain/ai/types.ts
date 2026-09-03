import type { AssetListItem } from "@/domain/assets/types";
import type { DocumentListItem } from "@/domain/documents/types";
import type { ReminderListItem } from "@/domain/reminders/types";
import type { TrustedContactListItem } from "@/domain/contacts/types";
import type { CapsuleListItem } from "@/domain/capsules/types";
import type { Category } from "@/domain/categories/types";

/**
 * FASE 10 --- HINTHIAL AI v0: uno snapshot strutturato e già decifrato
 * dei dati dell'utente, costruito interamente lato client (v.
 * context.ts). Nessuna chiamata esterna avviene per costruirlo --- è lo
 * stesso identico dato che ogni altra pagina dell'app già decifra.
 */
export interface AIContext {
  categories: Category[];
  assets: AssetListItem[];
  documents: DocumentListItem[];
  reminders: ReminderListItem[];
  contacts: TrustedContactListItem[];
  capsules: CapsuleListItem[];
}

/** Un'entità citata in una risposta o in un suggerimento --- collegata alla pagina dove l'utente può vederla. */
export interface AISource {
  kind: "asset" | "document" | "reminder" | "contact" | "capsule";
  id: string;
  label: string;
  href: string;
}

export interface AIAnswer {
  text: string;
  sources: AISource[];
}

export interface AISuggestion {
  text: string;
  sources: AISource[];
}

/**
 * Interfaccia richiesta da HINTHIAL_MVP.md FASE 10 --- pensata per
 * essere implementata sia da un provider locale (questo file, v.
 * mock-provider.ts) sia in futuro da un provider esterno esplicitamente
 * autorizzato (FASE 11, sezione "Explicit AI processing" del piano):
 * nessuna delle due modalità è legata a questa interfaccia in sé.
 */
export interface AIProvider {
  /** Corrispondenza diretta per parole chiave, nessuna relazione seguita. */
  search(query: string, context: AIContext): AISource[];
  /** Parte da search() e allarga seguendo le relazioni (asset -> documenti/scadenze collegati, capsula -> destinatari, categoria -> tutto ciò che contiene, ...); se non trova nulla di specifico ma la domanda nomina un intero tipo di entità ("quanti contatti ho?"), restituisce tutti gli elementi di quel tipo. */
  retrieve(query: string, context: AIContext): AISource[];
  /** Usa retrieve() e produce una risposta testuale, citando le fonti usate. */
  answer(query: string, context: AIContext): AIAnswer;
  /** Suggerimenti non richiesti, dedotti dallo stato attuale (scadenze scadute, asset senza documenti, ...). */
  suggest(context: AIContext): AISuggestion[];
}
