import { InvalidFormatError, UnsupportedVersionError } from "@/lib/crypto/errors";

export const ENVELOPE_VERSION = 1 as const;
export const ENVELOPE_ALG = "AES-256-GCM" as const;

/**
 * A versioned, JSON-safe ciphertext envelope. Used both for wrapped keys
 * and for encrypted document content --- see PROTOCOL.md.
 */
export interface EncryptedEnvelope {
  v: typeof ENVELOPE_VERSION;
  alg: typeof ENVELOPE_ALG;
  /** base64, 12 bytes */
  iv: string;
  /** base64; includes the AES-GCM authentication tag */
  ciphertext: string;
}

export function serializeEnvelope(envelope: EncryptedEnvelope): string {
  return JSON.stringify(envelope);
}

/**
 * Parses and validates a serialized envelope.
 *
 * Throws `UnsupportedVersionError` for a recognizable-but-unsupported
 * version, and `InvalidFormatError` for anything else that doesn't look
 * like a valid envelope (not JSON, missing fields, wrong types, wrong
 * algorithm).
 */
export function parseEnvelope(serialized: string): EncryptedEnvelope {
  let parsed: unknown;
  try {
    parsed = JSON.parse(serialized);
  } catch {
    throw new InvalidFormatError("Envelope is not valid JSON.");
  }

  if (typeof parsed !== "object" || parsed === null) {
    throw new InvalidFormatError("Envelope must be a JSON object.");
  }

  const candidate = parsed as Record<string, unknown>;

  if (candidate.v === undefined) {
    throw new InvalidFormatError("Envelope is missing a version field.");
  }
  if (candidate.v !== ENVELOPE_VERSION) {
    throw new UnsupportedVersionError(candidate.v);
  }
  if (candidate.alg !== ENVELOPE_ALG) {
    throw new InvalidFormatError(`Unsupported algorithm: ${JSON.stringify(candidate.alg)}`);
  }
  if (typeof candidate.iv !== "string" || candidate.iv.length === 0) {
    throw new InvalidFormatError("Envelope is missing a valid iv.");
  }
  if (typeof candidate.ciphertext !== "string" || candidate.ciphertext.length === 0) {
    throw new InvalidFormatError("Envelope is missing valid ciphertext.");
  }

  return {
    v: ENVELOPE_VERSION,
    alg: ENVELOPE_ALG,
    iv: candidate.iv,
    ciphertext: candidate.ciphertext,
  };
}
