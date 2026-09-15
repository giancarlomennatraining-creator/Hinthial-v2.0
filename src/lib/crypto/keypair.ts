import { encryptBytes, decryptBytes } from "@/lib/crypto/aes-gcm";
import { utf8ToBytes, bytesToUtf8 } from "@/lib/crypto/codec";
import { wipe } from "@/lib/crypto/memory";
import type { EncryptedEnvelope } from "@/lib/crypto/envelope";

/**
 * FASE C1 --- lo scambio di chiavi che permette a un destinatario di
 * decifrare davvero una capsula condivisa con lui, senza che il
 * proprietario gli passi la propria Master Key (romperebbe lo
 * zero-knowledge) e senza che il server veda mai nulla in chiaro. Ogni
 * account ha una coppia di chiavi ECDH (P-256, non RSA: più leggera, e
 * il segreto che ne esce diventa direttamente una normale chiave
 * AES-256-GCM --- la stessa identica primitiva già usata ovunque in
 * questo modulo, v. aes-gcm.ts): la pubblica in chiaro (v.
 * encryption_setup.public_key), la privata cifrata dalla propria
 * Master Key esattamente come si cifra una Document Key (v.
 * document-key.ts) --- resta stabile anche cambiando la master
 * password, perché la Master Key stessa non cambia in quel caso (v.
 * PROTOCOL.md).
 *
 * Non un protocollo nuovo: solo Web Crypto API nativa (ECDH +
 * AES-GCM), niente scritto a mano --- v. HINTHIAL_MVP.md sezione 3.
 */

const ECDH_PARAMS = { name: "ECDH", namedCurve: "P-256" } as const;

export interface KeyPairSetup {
  /** JSON di una JWK --- pubblica per definizione, salvata in chiaro. */
  publicKeyJwk: string;
  /** La chiave privata (JWK), cifrata dalla Master Key --- mai altrimenti in chiaro. */
  wrappedPrivateKey: EncryptedEnvelope;
}

/**
 * Genera una nuova coppia di chiavi per l'account corrente, pronta per
 * essere salvata --- v. KeyPairSetup. Chiamata una sola volta per
 * account (alla creazione della Master Key, o al primo sblocco
 * successivo per un account che non l'aveva ancora, v.
 * MasterKeyProvider).
 */
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

/** Importa una chiave pubblica ECDH (la propria, o quella di un altro account) --- usabile solo come "public" in deriveKey, mai per cifrare/decifrare da sola. */
async function importPublicKey(jwkJson: string): Promise<CryptoKey> {
  const jwk = JSON.parse(jwkJson) as JsonWebKey;
  return crypto.subtle.importKey("jwk", jwk, ECDH_PARAMS, true, []);
}

/**
 * Decifra (unwrap) e importa la propria chiave privata, salvata da
 * setupKeyPair --- serve per aprire una capsula condivisa con questo
 * account (v. domain/capsules/repository.ts, openSharedCapsule).
 * Lancia DecryptionError se la Master Key non è quella giusta.
 */
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
 * Genera una coppia di chiavi ECDH effimera (usa e getta) senza
 * derivare subito nulla --- v. FASE 13 (pairing tra dispositivi,
 * domain/device-pairing): a differenza di deriveSharedKeyAsSender, qui
 * chi genera la coppia non conosce ancora una chiave pubblica altrui
 * con cui derivare (il "nuovo dispositivo" la mostra come QR code e
 * aspetta che un dispositivo fidato risponda con LA SUA chiave pubblica
 * effimera, v. deriveSharedKeyAsRecipient per completare lo scambio da
 * questo lato). La chiave privata resta nella CryptoKey restituita,
 * mai serializzata --- vive solo in memoria, buttata via insieme alla
 * pagina se lo scambio non si completa.
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
 * Lato mittente: genera una coppia di chiavi effimera (usa e getta, una
 * per ogni condivisione) e deriva con essa la chiave AES-256-GCM
 * condivisa con il destinatario, a partire dalla sua chiave pubblica.
 * La chiave pubblica effimera va salvata insieme al contenuto cifrato
 * con la chiave condivisa --- è ciò che permette al destinatario di
 * ripetere la stessa derivazione (v. deriveSharedKeyAsRecipient).
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

/**
 * Lato destinatario: ridriva la STESSA chiave condivisa (proprietà
 * dell'ECDH --- il segreto dipende solo dalla coppia "la mia privata +
 * la sua pubblica", mai da chi delle due parti l'ha calcolato per
 * primo) usando la propria chiave privata e la chiave pubblica effimera
 * generata dal mittente.
 */
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
