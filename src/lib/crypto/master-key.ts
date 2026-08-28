import { generateSymmetricKey } from "@/lib/crypto/symmetric-key";
import { wrapKey, unwrapKey } from "@/lib/crypto/key-wrapping";
import { deriveKeyFromPassword, generatePbkdf2Params, type Pbkdf2Params } from "@/lib/crypto/pbkdf2";
import {
  deriveKeyFromRecoveryKey,
  generateRecoveryKey,
  parseRecoveryKey,
  type RecoveryKey,
} from "@/lib/crypto/recovery-key";
import { wipe } from "@/lib/crypto/memory";
import type { EncryptedEnvelope } from "@/lib/crypto/envelope";

/**
 * Everything produced when setting up encryption for a new account.
 * `recoveryKey.formatted` must be shown to the user exactly once ---
 * HINTHIAL never stores it. The two wrapped copies are what gets
 * persisted (as opaque ciphertext) alongside `pbkdf2Params`.
 */
export interface MasterKeySetup {
  masterKeyWrappedByPassword: EncryptedEnvelope;
  masterKeyWrappedByRecoveryKey: EncryptedEnvelope;
  pbkdf2Params: Pbkdf2Params;
  recoveryKey: RecoveryKey;
}

/**
 * Generates a new Master Key and wraps it two independent ways: with a
 * key derived from the master password, and with a key derived from a
 * freshly generated recovery key. Either wrapped copy can later unlock
 * the same Master Key --- see PROTOCOL.md.
 *
 * `pbkdf2Params` defaults to fresh, production-strength parameters
 * (`generatePbkdf2Params()`, see constants.ts); tests pass a
 * low-iteration override to stay fast.
 */
export async function setupMasterKey(
  password: string,
  pbkdf2Params: Pbkdf2Params = generatePbkdf2Params(),
): Promise<MasterKeySetup> {
  const masterKey = await generateSymmetricKey();
  const recoveryKey = generateRecoveryKey();

  const passwordKey = await deriveKeyFromPassword(password, pbkdf2Params);
  const recoveryDerivedKey = await deriveKeyFromRecoveryKey(recoveryKey.raw);

  const [masterKeyWrappedByPassword, masterKeyWrappedByRecoveryKey] = await Promise.all([
    wrapKey(passwordKey, masterKey),
    wrapKey(recoveryDerivedKey, masterKey),
  ]);

  return {
    masterKeyWrappedByPassword,
    masterKeyWrappedByRecoveryKey,
    pbkdf2Params,
    recoveryKey,
  };
}

/**
 * Unlocks (unwraps) the Master Key using the master password.
 * Throws `DecryptionError` if the password is wrong.
 */
export async function unlockMasterKeyWithPassword(
  password: string,
  pbkdf2Params: Pbkdf2Params,
  masterKeyWrappedByPassword: EncryptedEnvelope,
): Promise<CryptoKey> {
  const passwordKey = await deriveKeyFromPassword(password, pbkdf2Params);
  return unwrapKey(passwordKey, masterKeyWrappedByPassword);
}

/**
 * Unlocks (unwraps) the Master Key using the recovery key (its
 * human-transcribed form, as shown at setup).
 * Throws `InvalidFormatError` if it isn't a well-formed recovery key, or
 * `DecryptionError` if it's well-formed but wrong.
 */
export async function unlockMasterKeyWithRecoveryKey(
  formattedRecoveryKey: string,
  masterKeyWrappedByRecoveryKey: EncryptedEnvelope,
): Promise<CryptoKey> {
  const raw = parseRecoveryKey(formattedRecoveryKey);
  try {
    const recoveryDerivedKey = await deriveKeyFromRecoveryKey(raw);
    return await unwrapKey(recoveryDerivedKey, masterKeyWrappedByRecoveryKey);
  } finally {
    wipe(raw);
  }
}
