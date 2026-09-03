/**
 * Trascrizione automatica di un contenuto audio/video --- pensata come
 * TranscriptionProvider, sullo stesso modello di Categorizer
 * (v. domain/categorizer) e AIProvider (v. domain/ai): un'interfaccia
 * stabile che l'unica implementazione di oggi (v. stub-provider.ts) e
 * un futuro motore reale possono soddisfare allo stesso modo, senza
 * toccare chi la chiama.
 *
 * Nessuna libreria di riconoscimento vocale è stata aggiunta finché non
 * è verificato che funzioni interamente sul dispositivo: l'alternativa
 * più comune e immediata (la Web Speech API del browser) su
 * Chrome/Chromium invia l'audio ai server di Google per la trascrizione
 * --- l'opposto di "locale", e in contrasto con lo zero-knowledge di
 * Hinthial. Il motore reale (un modello eseguito interamente nel
 * browser, es. via WASM) arriverà con la FASE 11 --- fino ad allora
 * l'utente scrive la trascrizione a mano.
 */
export interface TranscriptionProvider {
  /** Mostrato in UI/log quando è utile sapere quale motore ha risposto. */
  readonly name: string;
  /** null = non disponibile automaticamente in questa versione. */
  transcribe(bytes: Uint8Array, mimeType: string): Promise<string | null>;
}
