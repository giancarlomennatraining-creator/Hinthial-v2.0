import { RECOVERY_KEY_HKDF_INFO, RECOVERY_KEY_LENGTH_BYTES } from "@/lib/crypto/constants";
import { randomBytes } from "@/lib/crypto/random";
import { utf8ToBytes } from "@/lib/crypto/codec";
import { InvalidFormatError } from "@/lib/crypto/errors";

export interface RecoveryKey {
  /** Raw secret bytes --- treat like a password: don't log it, wipe after use. */
  raw: Uint8Array<ArrayBuffer>;
  /** Human-transcribable form, shown to the user exactly once at setup. */
  formatted: string;
}

function toHexGroups(bytes: Uint8Array): string {
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0").toUpperCase())
    .join("");
  return (hex.match(/.{1,4}/g) ?? []).join("-");
}

/** Generates a new 256-bit recovery key. */
export function generateRecoveryKey(): RecoveryKey {
  const raw = randomBytes(RECOVERY_KEY_LENGTH_BYTES);
  return { raw, formatted: toHexGroups(raw) };
}

/**
 * Parses a recovery key back to raw bytes from its human-transcribed
 * form (dashes/whitespace are ignored, matching is case-insensitive).
 * Throws `InvalidFormatError` if it doesn't look like a recovery key
 * this module generated.
 */
export function parseRecoveryKey(formatted: string): Uint8Array<ArrayBuffer> {
  const hex = formatted.replace(/[\s-]/g, "");

  if (!/^[0-9a-fA-F]+$/.test(hex) || hex.length !== RECOVERY_KEY_LENGTH_BYTES * 2) {
    throw new InvalidFormatError("Recovery key format is invalid.");
  }

  const bytes = new Uint8Array(RECOVERY_KEY_LENGTH_BYTES);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

/**
 * Derives a non-extractable AES-256-GCM key from recovery key bytes via
 * HKDF --- domain-separated (via `info`) so these bytes can't be
 * repurposed as a key for anything else. Used only to wrap/unwrap the
 * Master Key, exactly like the password-derived key. See PROTOCOL.md.
 */
export async function deriveKeyFromRecoveryKey(
  rawRecoveryKey: Uint8Array<ArrayBuffer>,
): Promise<CryptoKey> {
  const keyMaterial = await crypto.subtle.importKey("raw", rawRecoveryKey, "HKDF", false, [
    "deriveKey",
  ]);

  return crypto.subtle.deriveKey(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: new Uint8Array(0),
      info: utf8ToBytes(RECOVERY_KEY_HKDF_INFO),
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}
