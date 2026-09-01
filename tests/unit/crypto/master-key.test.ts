import { describe, expect, it } from "vitest";
import {
  setupMasterKey,
  unlockMasterKeyWithPassword,
  unlockMasterKeyWithRecoveryKey,
} from "@/lib/crypto/master-key";
import { encryptBytes, decryptBytes } from "@/lib/crypto/aes-gcm";
import { utf8ToBytes, bytesToUtf8 } from "@/lib/crypto/codec";
import { DecryptionError, InvalidFormatError } from "@/lib/crypto/errors";
import { generatePbkdf2Params } from "@/lib/crypto/pbkdf2";

// setupMasterKey uses the production PBKDF2 iteration count by default;
// pass a low-iteration override to keep the test suite fast.
function setupWithFastPbkdf2(password: string) {
  return setupMasterKey(password, generatePbkdf2Params(100));
}

describe("master key setup + unlock", () => {
  it("unlocks with the correct password and decrypts data protected by the master key", async () => {
    const setup = await setupWithFastPbkdf2("correct horse battery staple");

    const masterKey = await unlockMasterKeyWithPassword(
      "correct horse battery staple",
      setup.pbkdf2Params,
      setup.masterKeyWrappedByPassword,
    );

    const envelope = await encryptBytes(masterKey, utf8ToBytes("protetto dalla master key"));
    const decrypted = await decryptBytes(masterKey, envelope);
    expect(bytesToUtf8(decrypted)).toBe("protetto dalla master key");
  });

  it("fails to unlock with the wrong password", async () => {
    const setup = await setupWithFastPbkdf2("correct horse battery staple");

    await expect(
      unlockMasterKeyWithPassword(
        "wrong password",
        setup.pbkdf2Params,
        setup.masterKeyWrappedByPassword,
      ),
    ).rejects.toThrow(DecryptionError);
  });

  it("unlocks with the recovery key and yields the same master key as the password path", async () => {
    const setup = await setupWithFastPbkdf2("correct horse battery staple");

    const viaPassword = await unlockMasterKeyWithPassword(
      "correct horse battery staple",
      setup.pbkdf2Params,
      setup.masterKeyWrappedByPassword,
    );
    const viaRecovery = await unlockMasterKeyWithRecoveryKey(
      setup.recoveryKey.formatted,
      setup.masterKeyWrappedByRecoveryKey,
    );

    // Same key in practice: data encrypted via one path decrypts via the other.
    const envelope = await encryptBytes(viaPassword, utf8ToBytes("stesso segreto"));
    const decrypted = await decryptBytes(viaRecovery, envelope);
    expect(bytesToUtf8(decrypted)).toBe("stesso segreto");
  });

  it("fails to unlock with a wrong (but well-formed) recovery key", async () => {
    const setupA = await setupWithFastPbkdf2("password A");
    const setupB = await setupWithFastPbkdf2("password B");

    await expect(
      unlockMasterKeyWithRecoveryKey(
        setupB.recoveryKey.formatted,
        setupA.masterKeyWrappedByRecoveryKey,
      ),
    ).rejects.toThrow(DecryptionError);
  });

  it("fails to unlock with a malformed recovery key", async () => {
    const setup = await setupWithFastPbkdf2("correct horse battery staple");

    await expect(
      unlockMasterKeyWithRecoveryKey("not-a-recovery-key", setup.masterKeyWrappedByRecoveryKey),
    ).rejects.toThrow(InvalidFormatError);
  });

  it("shows the recovery key formatted, ready for the user to transcribe", async () => {
    const setup = await setupWithFastPbkdf2("correct horse battery staple");
    expect(setup.recoveryKey.formatted).toMatch(/^[0-9A-F]{4}(-[0-9A-F]{4}){191}$/);
  });
});
