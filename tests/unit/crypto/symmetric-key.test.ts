import { describe, expect, it } from "vitest";
import { exportKeyRaw, generateSymmetricKey, importKeyRaw } from "@/lib/crypto/symmetric-key";
import { encryptBytes, decryptBytes } from "@/lib/crypto/aes-gcm";
import { utf8ToBytes, bytesToUtf8 } from "@/lib/crypto/codec";

describe("symmetric key", () => {
  it("generates a 256-bit extractable AES-GCM key", async () => {
    const key = await generateSymmetricKey();
    expect(key.algorithm.name).toBe("AES-GCM");
    expect((key.algorithm as AesKeyAlgorithm).length).toBe(256);
    expect(key.extractable).toBe(true);
  });

  it("generates a different key every time", async () => {
    const a = await exportKeyRaw(await generateSymmetricKey());
    const b = await exportKeyRaw(await generateSymmetricKey());
    expect(a).not.toEqual(b);
  });

  it("round-trips a key through raw export/import", async () => {
    const original = await generateSymmetricKey();
    const raw = await exportKeyRaw(original);
    const imported = await importKeyRaw(raw);

    const envelope = await encryptBytes(original, utf8ToBytes("data"));
    const decrypted = await decryptBytes(imported, envelope);
    expect(bytesToUtf8(decrypted)).toBe("data");
  });

  it("imports as non-extractable by default", async () => {
    const raw = await exportKeyRaw(await generateSymmetricKey());
    const imported = await importKeyRaw(raw);
    expect(imported.extractable).toBe(false);
  });
});
