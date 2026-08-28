import { IV_LENGTH_BYTES } from "@/lib/crypto/constants";
import { randomBytes } from "@/lib/crypto/random";
import { bytesToBase64, base64ToBytes } from "@/lib/crypto/codec";
import { DecryptionError } from "@/lib/crypto/errors";
import {
  ENVELOPE_ALG,
  ENVELOPE_VERSION,
  type EncryptedEnvelope,
} from "@/lib/crypto/envelope";

/** Encrypts `plaintext` with AES-256-GCM under `key`, using a fresh random IV. */
export async function encryptBytes(
  key: CryptoKey,
  plaintext: Uint8Array<ArrayBuffer>,
): Promise<EncryptedEnvelope> {
  const iv = randomBytes(IV_LENGTH_BYTES);
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plaintext);

  return {
    v: ENVELOPE_VERSION,
    alg: ENVELOPE_ALG,
    iv: bytesToBase64(iv),
    ciphertext: bytesToBase64(new Uint8Array(ciphertext)),
  };
}

/**
 * Decrypts an envelope produced by `encryptBytes`.
 *
 * Throws `DecryptionError` for a wrong key or corrupted/tampered
 * ciphertext --- AES-GCM authentication failures don't distinguish
 * between the two, and neither does this function.
 */
export async function decryptBytes(
  key: CryptoKey,
  envelope: EncryptedEnvelope,
): Promise<Uint8Array<ArrayBuffer>> {
  try {
    const plaintext = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: base64ToBytes(envelope.iv) },
      key,
      base64ToBytes(envelope.ciphertext),
    );
    return new Uint8Array(plaintext);
  } catch {
    throw new DecryptionError();
  }
}
