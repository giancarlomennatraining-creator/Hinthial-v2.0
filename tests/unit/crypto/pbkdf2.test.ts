import { describe, expect, it } from "vitest";
import {
  deriveKeyFromPassword,
  generatePbkdf2Params,
  parsePbkdf2Params,
  serializePbkdf2Params,
} from "@/lib/crypto/pbkdf2";
import { encryptBytes, decryptBytes } from "@/lib/crypto/aes-gcm";
import { utf8ToBytes, bytesToUtf8 } from "@/lib/crypto/codec";
import { InvalidFormatError, UnsupportedVersionError } from "@/lib/crypto/errors";
import { DecryptionError } from "@/lib/crypto/errors";

// Low iteration count so the test suite stays fast --- production code
// uses PBKDF2_ITERATIONS (600,000) by default, see constants.ts.
const FAST_ITERATIONS = 100;

describe("PBKDF2 key derivation", () => {
  it("derives the same key for the same password + params", async () => {
    const params = generatePbkdf2Params(FAST_ITERATIONS);
    const keyA = await deriveKeyFromPassword("correct horse battery staple", params);
    const keyB = await deriveKeyFromPassword("correct horse battery staple", params);

    const envelope = await encryptBytes(keyA, utf8ToBytes("data"));
    const decrypted = await decryptBytes(keyB, envelope);
    expect(bytesToUtf8(decrypted)).toBe("data");
  });

  it("derives a different key for a different password", async () => {
    const params = generatePbkdf2Params(FAST_ITERATIONS);
    const rightKey = await deriveKeyFromPassword("right password", params);
    const wrongKey = await deriveKeyFromPassword("wrong password", params);

    const envelope = await encryptBytes(rightKey, utf8ToBytes("data"));
    await expect(decryptBytes(wrongKey, envelope)).rejects.toThrow(DecryptionError);
  });

  it("derives a different key for a different salt, same password", async () => {
    const paramsA = generatePbkdf2Params(FAST_ITERATIONS);
    const paramsB = generatePbkdf2Params(FAST_ITERATIONS);
    expect(paramsA.salt).not.toBe(paramsB.salt);

    const keyA = await deriveKeyFromPassword("same password", paramsA);
    const keyB = await deriveKeyFromPassword("same password", paramsB);

    const envelope = await encryptBytes(keyA, utf8ToBytes("data"));
    await expect(decryptBytes(keyB, envelope)).rejects.toThrow(DecryptionError);
  });

  it("round-trips params through serialization", () => {
    const params = generatePbkdf2Params(FAST_ITERATIONS);
    expect(parsePbkdf2Params(serializePbkdf2Params(params))).toEqual(params);
  });

  it("rejects params with an unrecognized version", () => {
    const params = { ...generatePbkdf2Params(FAST_ITERATIONS), v: 99 };
    expect(() => parsePbkdf2Params(JSON.stringify(params))).toThrow(UnsupportedVersionError);
  });

  it.each([
    ["not JSON", "{bad"],
    ["missing salt", JSON.stringify({ v: 1, alg: "PBKDF2-SHA256", iterations: 100 })],
    [
      "negative iterations",
      JSON.stringify({ v: 1, alg: "PBKDF2-SHA256", iterations: -1, salt: "aGVsbG8=" }),
    ],
  ])("rejects corrupted params: %s", (_label, serialized) => {
    expect(() => parsePbkdf2Params(serialized)).toThrow(InvalidFormatError);
  });
});
