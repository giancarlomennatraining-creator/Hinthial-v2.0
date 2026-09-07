/**
 * Codici di backup monouso per l'MFA --- generazione e hashing, nessun
 * accesso al database qui (v. domain/mfa/repository.ts per quello).
 * Hashing con Web Crypto API (SHA-256), coerente con la regola del
 * progetto di non scrivere crypto custom: nessun algoritmo scritto a
 * mano, solo API native del browser (disponibili anche lato server: in
 * Node.js `crypto.subtle` è globale dalla v19 in poi, stessa identica
 * API in entrambi gli ambienti).
 */

// 32 simboli, esclusi i caratteri facilmente confondibili (0/O, 1/I/L) --- un codice si deve poter ricopiare a mano senza ambiguità.
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 10;

/** Un codice via l'altro, es. "AB3D9-K7M2Q" --- il trattino è solo leggibilità, ignorato dalla verifica. */
export function generateBackupCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(CODE_LENGTH));
  // 256 è divisibile esattamente per 32 (l'alfabeto): nessuna distorsione nella distribuzione.
  const chars = Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
  return `${chars.slice(0, 5)}-${chars.slice(5, 10)}`;
}

export function generateBackupCodes(count = 10): string[] {
  return Array.from({ length: count }, generateBackupCode);
}

/** Toglie spazi/trattini e uniforma il maiuscolo, così un codice incollato con o senza formattazione verifica allo stesso modo. */
export function normalizeBackupCode(code: string): string {
  return code.replace(/[\s-]/g, "").toUpperCase();
}

export async function hashBackupCode(code: string): Promise<string> {
  const data = new TextEncoder().encode(normalizeBackupCode(code));
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}
