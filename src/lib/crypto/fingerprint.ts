import { IV_LENGTH_BYTES, CONTENT_FINGERPRINT_LABEL } from "@/lib/crypto/constants";
import { bytesToBase64, utf8ToBytes } from "@/lib/crypto/codec";

/**
 * Impronta di un contenuto che solo chi ha la Master Key può calcolare (HMAC-SHA256): serve a riconoscere "è lo stesso
 * testo di prima?" senza salvare in chiaro un hash che chiunque potrebbe confrontare con un testo noto. Va custodita
 * come il resto del contenuto, dentro un blocco cifrato --- mai in una colonna in chiaro.
 *
 * La Master Key è non esportabile, quindi non si può ricavarne una chiave con HKDF: si cifra un'etichetta fissa con un
 * IV fisso e si usa l'output come chiave HMAC. Non è una costruzione standard e l'IV fisso sarebbe un errore per
 * cifrare dati veri; qui regge perché il testo cifrato è sempre lo stesso, non esce mai dal dispositivo e serve solo
 * come materiale segreto per la chiave HMAC.
 */
const hmacKeys = new WeakMap<CryptoKey, Promise<CryptoKey>>();

function deriveHmacKey(masterKey: CryptoKey): Promise<CryptoKey> {
  let derived = hmacKeys.get(masterKey);
  if (!derived) {
    derived = (async () => {
      const material = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv: new Uint8Array(IV_LENGTH_BYTES) },
        masterKey,
        utf8ToBytes(CONTENT_FINGERPRINT_LABEL),
      );
      return crypto.subtle.importKey("raw", material, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    })();
    hmacKeys.set(masterKey, derived);
  }
  return derived;
}

/** Ogni parte porta la sua lunghezza davanti: ["ab", "c"] e ["a", "bc"] non danno la stessa impronta. */
export async function contentFingerprint(masterKey: CryptoKey, parts: string[]): Promise<string> {
  const key = await deriveHmacKey(masterKey);
  const message = parts.map((part) => `${part.length}:${part}`).join("\n");
  const signature = await crypto.subtle.sign("HMAC", key, utf8ToBytes(message));
  return bytesToBase64(new Uint8Array(signature));
}
