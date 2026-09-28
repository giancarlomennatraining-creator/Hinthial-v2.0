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

/** Recovery key length: 3072 bits, far more than the 256 bits an AES-256 key needs (HKDF condenses it down) — a longer, more visibly "random-looking" secret is harder to mistake for something guessable when transcribed by hand. */
export const RECOVERY_KEY_LENGTH_BYTES = 384;

/** Domain-separation string for deriving a key from the recovery key via HKDF. */
export const RECOVERY_KEY_HKDF_INFO = "hinthial:recovery-key:v1";

/** Domain-separation string for deriving a key from a WebAuthn PRF output via HKDF (v. lib/crypto/device-lock.ts), same reason as RECOVERY_KEY_HKDF_INFO. */
export const DEVICE_LOCK_HKDF_INFO = "hinthial:device-lock:v1";

/**
 * Il "salt" dato in input all'estensione PRF di WebAuthn: non deve essere segreto (è l'output del PRF, non l'input,
 * ciò che conta), solo stabile per ottenere lo stesso risultato dallo stesso dispositivo. A differenza del salt
 * PBKDF2/di un envelope, che DEVONO essere unici per ogni segreto, questo resta deliberatamente lo stesso.
 */
export const DEVICE_LOCK_PRF_SALT_LABEL = "hinthial:device-lock:prf-salt:v1";
