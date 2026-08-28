import { generateSymmetricKey } from "@/lib/crypto/symmetric-key";
import { wrapKey, unwrapKey } from "@/lib/crypto/key-wrapping";
import { encryptBytes, decryptBytes } from "@/lib/crypto/aes-gcm";
import type { EncryptedEnvelope } from "@/lib/crypto/envelope";

/** What gets stored for one encrypted document: its wrapped key + its ciphertext. */
export interface EncryptedDocument {
  wrappedDocumentKey: EncryptedEnvelope;
  payload: EncryptedEnvelope;
}

/**
 * Encrypts `plaintext` under a freshly generated, random Document Key,
 * itself wrapped by the Master Key --- see PROTOCOL.md. Each document
 * gets its own key so that, later, revoking or rotating access to one
 * document never requires touching any other document's ciphertext.
 */
export async function encryptDocument(
  masterKey: CryptoKey,
  plaintext: Uint8Array<ArrayBuffer>,
): Promise<EncryptedDocument> {
  const documentKey = await generateSymmetricKey();

  const [wrappedDocumentKey, payload] = await Promise.all([
    wrapKey(masterKey, documentKey),
    encryptBytes(documentKey, plaintext),
  ]);

  return { wrappedDocumentKey, payload };
}

/**
 * Decrypts a document produced by `encryptDocument`.
 * Throws `DecryptionError` if `masterKey` doesn't match the one used to
 * wrap the document's key, or if either envelope was corrupted/tampered
 * with.
 */
export async function decryptDocument(
  masterKey: CryptoKey,
  encrypted: EncryptedDocument,
): Promise<Uint8Array<ArrayBuffer>> {
  const documentKey = await unwrapKey(masterKey, encrypted.wrappedDocumentKey);
  return decryptBytes(documentKey, encrypted.payload);
}
