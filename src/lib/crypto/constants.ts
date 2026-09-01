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

/**
 * Recovery key length --- 3072 bits (192 groups of 4 hex chars in the
 * transcribed form). Deliberately far more than the 256 bits an AES-256
 * key needs (HKDF happily condenses any amount of good input entropy
 * down to the required output length): a longer, more visibly
 * "random-looking" secret is harder to mistake for something guessable
 * when a user is transcribing/storing it by hand.
 */
export const RECOVERY_KEY_LENGTH_BYTES = 384;

/** Domain-separation string for deriving a key from the recovery key via HKDF. */
export const RECOVERY_KEY_HKDF_INFO = "hinthial:recovery-key:v1";
