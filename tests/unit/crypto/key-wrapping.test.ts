import { describe, expect, it } from "vitest";
import { unwrapKey, wrapKey } from "@/lib/crypto/key-wrapping";
import { generateSymmetricKey, exportKeyRaw } from "@/lib/crypto/symmetric-key";
import { encryptBytes, decryptBytes } from "@/lib/crypto/aes-gcm";
import { utf8ToBytes, bytesToUtf8 } from "@/lib/crypto/codec";
import { DecryptionError } from "@/lib/crypto/errors";

describe("key wrapping", () => {
  it("wraps and unwraps a key, producing a usable equivalent key", async () => {
    const wrappingKey = await generateSymmetricKey();
    const keyToWrap = await generateSymmetricKey();

    const wrapped = await wrapKey(wrappingKey, keyToWrap);
    const unwrapped = await unwrapKey(wrappingKey, wrapped);

    // Confirm it's functionally the same key: encrypt with the original,
    // decrypt with the unwrapped copy.
    const envelope = await encryptBytes(keyToWrap, utf8ToBytes("payload"));
    const decrypted = await decryptBytes(unwrapped, envelope);
    expect(bytesToUtf8(decrypted)).toBe("payload");
  });

  it("fails to unwrap with the wrong wrapping key", async () => {
    const wrappingKey = await generateSymmetricKey();
    const wrongKey = await generateSymmetricKey();
    const keyToWrap = await generateSymmetricKey();

    const wrapped = await wrapKey(wrappingKey, keyToWrap);

    await expect(unwrapKey(wrongKey, wrapped)).rejects.toThrow(DecryptionError);
  });

  it("unwraps to a non-extractable key by default", async () => {
    const wrappingKey = await generateSymmetricKey();
    const keyToWrap = await generateSymmetricKey();

    const wrapped = await wrapKey(wrappingKey, keyToWrap);
    const unwrapped = await unwrapKey(wrappingKey, wrapped);

    expect(unwrapped.extractable).toBe(false);
    await expect(exportKeyRaw(unwrapped)).rejects.toThrow();
  });
});
