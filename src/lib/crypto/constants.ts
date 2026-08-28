/**
 * OWASP (2023) minimum recommendation for PBKDF2-HMAC-SHA256. See
 * PROTOCOL.md for why PBKDF2 rather than a memory-hard KDF for now.
 */
export const PBKDF2_ITERATIONS = 600_000;

/** AES-GCM recommended IV length: 96 bits. */
export const IV_LENGTH_BYTES = 12;

/** AES-256 key length. */
export const KEY_LENGTH_BYTES = 32;

/** PBKDF2 salt length. */
export const SALT_LENGTH_BYTES = 16;

/** Recovery key length --- 256 bits, matching an AES-256 key. */
export const RECOVERY_KEY_LENGTH_BYTES = 32;

/** Domain-separation string for deriving a key from the recovery key via HKDF. */
export const RECOVERY_KEY_HKDF_INFO = "hinthial:recovery-key:v1";
