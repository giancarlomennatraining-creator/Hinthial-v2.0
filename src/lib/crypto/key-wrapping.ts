import { encryptBytes, decryptBytes } from "@/lib/crypto/aes-gcm";
import { exportKeyRaw, importKeyRaw } from "@/lib/crypto/symmetric-key";
import { wipe } from "@/lib/crypto/memory";
import type { EncryptedEnvelope } from "@/lib/crypto/envelope";

/** Encrypts (wraps) `keyToWrap`'s raw bytes under `wrappingKey`. */
export async function wrapKey(
  wrappingKey: CryptoKey,
  keyToWrap: CryptoKey,
): Promise<EncryptedEnvelope> {
  const raw = await exportKeyRaw(keyToWrap);
  try {
    return await encryptBytes(wrappingKey, raw);
  } finally {
    wipe(raw);
  }
}

/**
 * Decrypts (unwraps) an envelope produced by `wrapKey` back into a
 * usable AES-256-GCM key. Throws `DecryptionError` (see aes-gcm.ts) for
 * a wrong wrapping key or corrupted/tampered envelope.
 */
export async function unwrapKey(
  wrappingKey: CryptoKey,
  envelope: EncryptedEnvelope,
  extractable = false,
): Promise<CryptoKey> {
  const raw = await decryptBytes(wrappingKey, envelope);
  try {
    return await importKeyRaw(raw, extractable);
  } finally {
    wipe(raw);
  }
}
