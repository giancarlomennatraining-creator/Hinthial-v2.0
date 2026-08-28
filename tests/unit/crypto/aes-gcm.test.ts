import { describe, expect, it } from "vitest";
import { decryptBytes, encryptBytes } from "@/lib/crypto/aes-gcm";
import { generateSymmetricKey } from "@/lib/crypto/symmetric-key";
import { base64ToBytes, bytesToBase64, bytesToUtf8, utf8ToBytes } from "@/lib/crypto/codec";
import { DecryptionError } from "@/lib/crypto/errors";

describe("AES-256-GCM encrypt/decrypt", () => {
  it("round-trips plaintext", async () => {
    const key = await generateSymmetricKey();
    const plaintext = utf8ToBytes("i miei documenti importanti");

    const envelope = await encryptBytes(key, plaintext);
    const decrypted = await decryptBytes(key, envelope);

    expect(bytesToUtf8(decrypted)).toBe("i miei documenti importanti");
  });

  it("produces a different IV (and ciphertext) on every call, even for the same plaintext", async () => {
    const key = await generateSymmetricKey();
    const plaintext = utf8ToBytes("same content");

    const first = await encryptBytes(key, plaintext);
    const second = await encryptBytes(key, plaintext);

    expect(first.iv).not.toBe(second.iv);
    expect(first.ciphertext).not.toBe(second.ciphertext);
  });

  it("fails to decrypt with the wrong password (wrong key)", async () => {
    const rightKey = await generateSymmetricKey();
    const wrongKey = await generateSymmetricKey();
    const envelope = await encryptBytes(rightKey, utf8ToBytes("secret"));

    await expect(decryptBytes(wrongKey, envelope)).rejects.toThrow(DecryptionError);
  });

  it("fails to decrypt tampered (corrupted) ciphertext", async () => {
    const key = await generateSymmetricKey();
    const envelope = await encryptBytes(key, utf8ToBytes("secret"));

    const tamperedBytes = base64ToBytes(envelope.ciphertext);
    tamperedBytes[0] ^= 0xff; // flip a bit
    const tampered = { ...envelope, ciphertext: bytesToBase64(tamperedBytes) };

    await expect(decryptBytes(key, tampered)).rejects.toThrow(DecryptionError);
  });

  it("fails to decrypt with a truncated ciphertext", async () => {
    const key = await generateSymmetricKey();
    const envelope = await encryptBytes(key, utf8ToBytes("secret"));

    const truncated = {
      ...envelope,
      ciphertext: bytesToBase64(base64ToBytes(envelope.ciphertext).slice(0, 4)),
    };

    await expect(decryptBytes(key, truncated)).rejects.toThrow(DecryptionError);
  });

  it("round-trips a large payload (a few MB)", async () => {
    const key = await generateSymmetricKey();
    const large = new Uint8Array(4 * 1024 * 1024); // 4 MB
    const chunk = new Uint8Array(65536);
    crypto.getRandomValues(chunk);
    for (let i = 0; i < large.length; i += chunk.length) {
      large.set(chunk.subarray(0, Math.min(chunk.length, large.length - i)), i);
    }

    const envelope = await encryptBytes(key, large);
    const decrypted = await decryptBytes(key, envelope);

    expect(decrypted).toEqual(large);
  }, 20_000);

  it("handles empty plaintext", async () => {
    const key = await generateSymmetricKey();
    const envelope = await encryptBytes(key, new Uint8Array(0));
    const decrypted = await decryptBytes(key, envelope);
    expect(decrypted).toEqual(new Uint8Array(0));
  });
});
