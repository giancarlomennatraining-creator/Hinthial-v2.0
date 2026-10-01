import { bytesToUtf8, decryptBytes, encryptBytes, parseEnvelope, serializeEnvelope, utf8ToBytes } from "@/lib/crypto";

/** Titolo di un item cifrato con la master key, per `audit_events.encrypted_label` (v. migrazione 20261003). */
export async function encryptAuditLabel(masterKey: CryptoKey, label: string): Promise<string> {
  return serializeEnvelope(await encryptBytes(masterKey, utf8ToBytes(label)));
}

/** Null se l'etichetta non si decifra (chiave diversa, dato corrotto): il registro resta leggibile senza. */
export async function decryptAuditLabel(masterKey: CryptoKey, encrypted: string): Promise<string | null> {
  try {
    return bytesToUtf8(await decryptBytes(masterKey, parseEnvelope(encrypted)));
  } catch {
    return null;
  }
}
