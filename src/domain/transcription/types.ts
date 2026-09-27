/**
 * Stesso schema a provider di Categorizer/AIProvider. Nessuna libreria vocale ancora: la Web Speech API manda l'audio
 * ai server di Google, l'opposto di zero-knowledge --- fino a un motore WASM locale (FASE 11), l'utente scrive a mano.
 */
export interface TranscriptionProvider {
  /** Mostrato in UI/log quando è utile sapere quale motore ha risposto. */
  readonly name: string;
  /** null = non disponibile automaticamente in questa versione. */
  transcribe(bytes: Uint8Array, mimeType: string): Promise<string | null>;
}
