import { PBKDF2_ITERATIONS, SALT_LENGTH_BYTES } from "@/lib/crypto/constants";
import { randomBytes } from "@/lib/crypto/random";
import { bytesToBase64, base64ToBytes, utf8ToBytes } from "@/lib/crypto/codec";
import { InvalidFormatError, UnsupportedVersionError } from "@/lib/crypto/errors";

export const PBKDF2_PARAMS_VERSION = 1 as const;
export const PBKDF2_ALG = "PBKDF2-SHA256" as const;

/**
 * Parameters needed to re-derive the same key from the same password on
 * a later login. Not secret (the salt's purpose is uniqueness, not
 * confidentiality) --- safe to store server-side alongside the
 * password-wrapped Master Key.
 */
export interface Pbkdf2Params {
  v: typeof PBKDF2_PARAMS_VERSION;
  alg: typeof PBKDF2_ALG;
  iterations: number;
  /** base64 */
  salt: string;
}

export function generatePbkdf2Params(iterations = PBKDF2_ITERATIONS): Pbkdf2Params {
  return {
    v: PBKDF2_PARAMS_VERSION,
    alg: PBKDF2_ALG,
    iterations,
    salt: bytesToBase64(randomBytes(SALT_LENGTH_BYTES)),
  };
}

export function serializePbkdf2Params(params: Pbkdf2Params): string {
  return JSON.stringify(params);
}

export function parsePbkdf2Params(serialized: string): Pbkdf2Params {
  let parsed: unknown;
  try {
    parsed = JSON.parse(serialized);
  } catch {
    throw new InvalidFormatError("PBKDF2 params are not valid JSON.");
  }

  if (typeof parsed !== "object" || parsed === null) {
    throw new InvalidFormatError("PBKDF2 params must be a JSON object.");
  }

  const candidate = parsed as Record<string, unknown>;

  if (candidate.v === undefined) {
    throw new InvalidFormatError("PBKDF2 params are missing a version field.");
  }
  if (candidate.v !== PBKDF2_PARAMS_VERSION) {
    throw new UnsupportedVersionError(candidate.v);
  }
  if (candidate.alg !== PBKDF2_ALG) {
    throw new InvalidFormatError(`Unsupported algorithm: ${JSON.stringify(candidate.alg)}`);
  }
  if (typeof candidate.iterations !== "number" || candidate.iterations <= 0) {
    throw new InvalidFormatError("PBKDF2 params have an invalid iteration count.");
  }
  if (typeof candidate.salt !== "string" || candidate.salt.length === 0) {
    throw new InvalidFormatError("PBKDF2 params are missing a valid salt.");
  }

  return {
    v: PBKDF2_PARAMS_VERSION,
    alg: PBKDF2_ALG,
    iterations: candidate.iterations,
    salt: candidate.salt,
  };
}

/**
 * Derives a non-extractable AES-256-GCM key from a password. Used only
 * to wrap/unwrap the Master Key --- never to encrypt content directly.
 * See PROTOCOL.md.
 */
export async function deriveKeyFromPassword(
  password: string,
  params: Pbkdf2Params,
): Promise<CryptoKey> {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    utf8ToBytes(password),
    "PBKDF2",
    false,
    ["deriveKey"],
  );

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: base64ToBytes(params.salt),
      iterations: params.iterations,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}
