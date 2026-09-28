import { encryptBytes, decryptBytes } from "@/lib/crypto/aes-gcm";
import { utf8ToBytes, bytesToUtf8 } from "@/lib/crypto/codec";
import { wipe } from "@/lib/crypto/memory";
import type { EncryptedEnvelope } from "@/lib/crypto/envelope";

/**
 * Lo scambio di chiavi che permette a un destinatario di decifrare una capsula condivisa senza che il proprietario
 * gli passi la propria Master Key (romperebbe lo zero-knowledge) e senza che il server veda mai nulla in chiaro.
 * Ogni account ha una coppia ECDH (P-256): la pubblica in chiaro, la privata cifrata dalla propria Master Key come
 * una Document Key (v. document-key.ts) --- resta stabile anche cambiando la master password. Solo Web Crypto API
 * nativa (ECDH + AES-GCM), niente scritto a mano.
 */

const ECDH_PARAMS = { name: "ECDH", namedCurve: "P-256" } as const;

export interface KeyPairSetup {
  /** JSON di una JWK, pubblica per definizione, salvata in chiaro. */
  publicKeyJwk: string;
  /** La chiave privata (JWK), cifrata dalla Master Key, mai altrimenti in chiaro. */
  wrappedPrivateKey: EncryptedEnvelope;
}

/** Genera una nuova coppia di chiavi per l'account corrente, pronta per essere salvata. Chiamata una sola volta per account (v. MasterKeyProvider). */
export async function setupKeyPair(masterKey: CryptoKey): Promise<KeyPairSetup> {
  const keyPair = await crypto.subtle.generateKey(ECDH_PARAMS, true, ["deriveKey"]);
  const [publicJwk, privateJwk] = await Promise.all([
    crypto.subtle.exportKey("jwk", keyPair.publicKey),
    crypto.subtle.exportKey("jwk", keyPair.privateKey),
  ]);

  const privateBytes = utf8ToBytes(JSON.stringify(privateJwk));
  try {
    const wrappedPrivateKey = await encryptBytes(masterKey, privateBytes);
    return { publicKeyJwk: JSON.stringify(publicJwk), wrappedPrivateKey };
  } finally {
    wipe(privateBytes);
  }
}

/** Importa una chiave pubblica ECDH, usabile solo come "public" in deriveKey, mai per cifrare/decifrare da sola. */
async function importPublicKey(jwkJson: string): Promise<CryptoKey> {
  const jwk = JSON.parse(jwkJson) as JsonWebKey;
  return crypto.subtle.importKey("jwk", jwk, ECDH_PARAMS, true, []);
}

/** Decifra e importa la propria chiave privata, salvata da setupKeyPair: serve per aprire una capsula condivisa. Lancia DecryptionError se la Master Key non è quella giusta. */
export async function unwrapPrivateKey(
  masterKey: CryptoKey,
  wrapped: EncryptedEnvelope,
): Promise<CryptoKey> {
  const bytes = await decryptBytes(masterKey, wrapped);
  try {
    const jwk = JSON.parse(bytesToUtf8(bytes)) as JsonWebKey;
    return await crypto.subtle.importKey("jwk", jwk, ECDH_PARAMS, false, ["deriveKey"]);
  } finally {
    wipe(bytes);
  }
}

/**
 * Genera una coppia di chiavi ECDH effimera senza derivare subito nulla (v. pairing tra dispositivi,
 * domain/device-pairing): chi la genera non conosce ancora la chiave pubblica altrui con cui derivare, mostra la
 * propria come QR e aspetta la risposta (v. deriveSharedKeyAsRecipient). La chiave privata resta nella CryptoKey
 * restituita, mai serializzata: vive solo in memoria.
 */
export async function generateEphemeralKeyPair(): Promise<{
  privateKey: CryptoKey;
  publicKeyJwk: string;
}> {
  const keyPair = await crypto.subtle.generateKey(ECDH_PARAMS, true, ["deriveKey"]);
  const publicJwk = await crypto.subtle.exportKey("jwk", keyPair.publicKey);
  return { privateKey: keyPair.privateKey, publicKeyJwk: JSON.stringify(publicJwk) };
}

/**
 * Lato mittente: genera una coppia effimera e deriva con essa la chiave AES-256-GCM condivisa col destinatario, a
 * partire dalla sua chiave pubblica. La chiave pubblica effimera va salvata insieme al contenuto cifrato: permette
 * al destinatario di ripetere la stessa derivazione (v. deriveSharedKeyAsRecipient).
 */
export async function deriveSharedKeyAsSender(
  recipientPublicKeyJwk: string,
): Promise<{ sharedKey: CryptoKey; ephemeralPublicKeyJwk: string }> {
  const recipientPublicKey = await importPublicKey(recipientPublicKeyJwk);
  const ephemeralKeyPair = await crypto.subtle.generateKey(ECDH_PARAMS, true, ["deriveKey"]);

  const sharedKey = await crypto.subtle.deriveKey(
    { name: "ECDH", public: recipientPublicKey },
    ephemeralKeyPair.privateKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
  const ephemeralPublicJwk = await crypto.subtle.exportKey("jwk", ephemeralKeyPair.publicKey);

  return { sharedKey, ephemeralPublicKeyJwk: JSON.stringify(ephemeralPublicJwk) };
}

/** Lato destinatario: rideriva la STESSA chiave condivisa (proprietà dell'ECDH: il segreto dipende solo dalla coppia "la mia privata + la sua pubblica") usando la propria chiave privata e quella pubblica effimera del mittente. */
export async function deriveSharedKeyAsRecipient(
  myPrivateKey: CryptoKey,
  ephemeralPublicKeyJwk: string,
): Promise<CryptoKey> {
  const ephemeralPublicKey = await importPublicKey(ephemeralPublicKeyJwk);
  return crypto.subtle.deriveKey(
    { name: "ECDH", public: ephemeralPublicKey },
    myPrivateKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}
