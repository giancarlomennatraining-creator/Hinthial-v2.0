/**
 * Generates a new random AES-256-GCM key.
 *
 * `extractable: true` because keys created this way (Master Key,
 * Document Key) need to be exported so they can be wrapped --- see
 * key-wrapping.ts.
 */
export async function generateSymmetricKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, [
    "encrypt",
    "decrypt",
  ]);
}

export async function exportKeyRaw(key: CryptoKey): Promise<Uint8Array<ArrayBuffer>> {
  const raw = await crypto.subtle.exportKey("raw", key);
  return new Uint8Array(raw);
}

export async function importKeyRaw(
  raw: Uint8Array<ArrayBuffer>,
  extractable = false,
): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, extractable, [
    "encrypt",
    "decrypt",
  ]);
}
