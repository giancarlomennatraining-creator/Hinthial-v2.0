import { describe, expect, it } from "vitest";
import {
  deriveKeyFromRecoveryKey,
  generateRecoveryKey,
  parseRecoveryKey,
} from "@/lib/crypto/recovery-key";
import { encryptBytes, decryptBytes } from "@/lib/crypto/aes-gcm";
import { utf8ToBytes, bytesToUtf8 } from "@/lib/crypto/codec";
import { InvalidFormatError, DecryptionError } from "@/lib/crypto/errors";

describe("recovery key", () => {
  it("generates a 256-bit key formatted as dash-grouped hex", () => {
    const { raw, formatted } = generateRecoveryKey();
    expect(raw.length).toBe(32);
    expect(formatted).toMatch(/^[0-9A-F]{4}(-[0-9A-F]{4}){15}$/);
  });

  it("generates a different key every time", () => {
    const a = generateRecoveryKey();
    const b = generateRecoveryKey();
    expect(a.formatted).not.toBe(b.formatted);
  });

  it("round-trips the formatted form back to the same raw bytes", () => {
    const { raw, formatted } = generateRecoveryKey();
    expect(parseRecoveryKey(formatted)).toEqual(raw);
  });

  it("parses case-insensitively and ignores surrounding whitespace", () => {
    const { raw, formatted } = generateRecoveryKey();
    expect(parseRecoveryKey(`  ${formatted.toLowerCase()}  `)).toEqual(raw);
  });

  it.each([
    ["too short", "ABCD-1234"],
    ["not hex", "ZZZZ-ZZZZ-ZZZZ-ZZZZ-ZZZZ-ZZZZ-ZZZZ-ZZZZ-ZZZZ-ZZZZ-ZZZZ-ZZZZ-ZZZZ-ZZZZ-ZZZZ-ZZZZ"],
    ["empty", ""],
  ])("rejects an invalid recovery key format: %s", (_label, input) => {
    expect(() => parseRecoveryKey(input)).toThrow(InvalidFormatError);
  });

  it("derives a usable key from the raw recovery key", async () => {
    const { raw } = generateRecoveryKey();
    const key = await deriveKeyFromRecoveryKey(raw);

    const envelope = await encryptBytes(key, utf8ToBytes("payload"));
    const decrypted = await decryptBytes(key, envelope);
    expect(bytesToUtf8(decrypted)).toBe("payload");
  });

  it("derives different keys from different recovery keys", async () => {
    const a = await deriveKeyFromRecoveryKey(generateRecoveryKey().raw);
    const b = await deriveKeyFromRecoveryKey(generateRecoveryKey().raw);

    const envelope = await encryptBytes(a, utf8ToBytes("payload"));
    await expect(decryptBytes(b, envelope)).rejects.toThrow(DecryptionError);
  });
});
