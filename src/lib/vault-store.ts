/**
 * La memoria condivisa dei dati della cassaforte sbloccata. Ogni pagina rilegge e decifra gli stessi elenchi (categorie, beni,
 * fascicoli, documenti, amici…) a ogni apertura, e finché non arrivano mostra uno scheletro: da una pagina all'altra si
 * aspettava ogni volta. Qui si tiene l'ultima copia già decifrata; chi ritorna su una pagina già vista la mostra subito e, in
 * parallelo, rilegge i dati come sempre e li aggiorna (il vecchio si vede mentre arriva il nuovo, mai al posto suo).
 *
 * Sicurezza: sono gli stessi dati che i componenti già tengono in memoria mentre la pagina è aperta, non di più né fuori
 * dalla cassaforte. Appartengono a una sola master key per volta: con una chiave diversa non si vedono. Si svuota tutto al
 * blocco (v. `lock` in MasterKeyProvider). Mai su disco, mai sul server.
 *
 * Coerenza: le funzioni che scrivono (i `repository.ts` dentro `domain`) chiamano `invalidateVault` per i dati che toccano, così
 * dopo una modifica la pagina successiva non mostra il vecchio nemmeno un istante. Se una scrittura sfuggisse, il rischio è
 * solo un attimo di dato vecchio: ogni pagina rilegge comunque a ogni apertura.
 */

/** Le chiavi dei dati condivisi: una per funzione di lettura, perché due funzioni diverse restituiscono forme diverse. */
export const VAULT = {
  categories: "categories",
  assets: "assets",
  dossiers: "dossiers",
  documents: "documents", // listDocumentSummaries
  reminders: "reminders",
  documentExpiries: "document-expiries",
  friends: "friends",
  capsules: "capsules",
  capsulesShared: "capsules-shared",
  capsuleCountdown: "capsule-countdown",
} as const;

export type VaultKey = (typeof VAULT)[keyof typeof VAULT];

let owner: CryptoKey | null = null;
let store = new Map<VaultKey, unknown>();

export function peekVault<T>(masterKey: CryptoKey, key: VaultKey): T | undefined {
  return owner === masterKey ? (store.get(key) as T | undefined) : undefined;
}

export function putVault<T>(masterKey: CryptoKey, key: VaultKey, value: T): void {
  if (owner !== masterKey) {
    // Un'altra chiave (un altro account, o la stessa riaperta): niente si mescola con ciò che c'era.
    owner = masterKey;
    store = new Map();
  }
  store.set(key, value);
}

/** Toglie dati dalla memoria: la prossima apertura mostra lo scheletro e legge da zero. Va chiamata da chi li modifica. */
export function invalidateVault(...keys: VaultKey[]): void {
  for (const key of keys) store.delete(key);
}

/** Svuota tutto: al blocco della cassaforte. */
export function clearVaultCache(): void {
  owner = null;
  store = new Map();
}
