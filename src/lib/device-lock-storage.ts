/**
 * FASE 13 --- dove vive, su QUESTO dispositivo, la copia locale del
 * Master Key protetta da WebAuthn (v. lib/crypto/device-lock.ts): non
 * in un cookie/sessionStorage (sparirebbe chiudendo la scheda, vanificando
 * lo scopo), solo in localStorage --- come il tema o la compressione
 * della barra laterale (v. lib/sidebar.ts), mai sincronizzata col
 * server. `wrappedMasterKey` è già cifrato (un envelope AES-GCM, la
 * stessa forma usata ovunque nel resto dell'app): anche leggendolo
 * direttamente dal localStorage del browser non si ottiene nulla senza
 * la chiave derivata dall'impronta/Face ID su questo stesso dispositivo.
 *
 * Un solo browser può ospitare più account Hinthial nel tempo (stesso
 * PC, account diversi): la mappa è per `ownerId`, non un singolo record.
 */

const STORAGE_KEY = "hinthial-device-lock";

export interface DeviceLockRecord {
  /** Riga in trusted_devices --- serve per "dimenticare" il dispositivo senza doverla ritrovare da credentialId. */
  deviceId: string;
  /** base64, la credenziale WebAuthn registrata su questo dispositivo per questo account. */
  credentialId: string;
  /** Envelope serializzato (v. lib/crypto/envelope.ts) --- il Master Key cifrato con la chiave derivata dal PRF. */
  wrappedMasterKey: string;
}

type StoredMap = Record<string, DeviceLockRecord>;

function readAll(): StoredMap {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed !== null ? (parsed as StoredMap) : {};
  } catch {
    return {};
  }
}

function writeAll(map: StoredMap): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    // Storage non disponibile (privacy mode, quota, ...): il dispositivo
    // resta semplicemente non fidato per questa sessione.
  }
}

export function getDeviceLockRecord(ownerId: string): DeviceLockRecord | null {
  return readAll()[ownerId] ?? null;
}

export function setDeviceLockRecord(ownerId: string, record: DeviceLockRecord): void {
  const all = readAll();
  all[ownerId] = record;
  writeAll(all);
}

export function clearDeviceLockRecord(ownerId: string): void {
  const all = readAll();
  delete all[ownerId];
  writeAll(all);
}
