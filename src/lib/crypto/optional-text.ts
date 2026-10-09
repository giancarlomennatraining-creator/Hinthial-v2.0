import { encryptBytes, decryptBytes } from "@/lib/crypto/aes-gcm";
import { bytesToUtf8, utf8ToBytes } from "@/lib/crypto/codec";
import { parseEnvelope, serializeEnvelope } from "@/lib/crypto/envelope";

/** Testo in chiaro -> busta cifrata serializzata; vuoto -> null: niente da cifrare, niente da salvare. */
export async function encryptOptionalText(masterKey: CryptoKey, text: string): Promise<string | null> {
  if (!text.trim()) return null;
  return serializeEnvelope(await encryptBytes(masterKey, utf8ToBytes(text)));
}

/** L'inverso: busta cifrata serializzata -> testo; null -> stringa vuota. */
export async function decryptOptionalText(masterKey: CryptoKey, serialized: string | null): Promise<string> {
  if (!serialized) return "";
  const bytes = await decryptBytes(masterKey, parseEnvelope(serialized));
  return bytesToUtf8(bytes);
}
