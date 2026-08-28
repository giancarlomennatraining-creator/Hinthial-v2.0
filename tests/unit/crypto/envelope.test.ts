import { describe, expect, it } from "vitest";
import {
  ENVELOPE_ALG,
  ENVELOPE_VERSION,
  parseEnvelope,
  serializeEnvelope,
  type EncryptedEnvelope,
} from "@/lib/crypto/envelope";
import { InvalidFormatError, UnsupportedVersionError } from "@/lib/crypto/errors";

function validEnvelope(): EncryptedEnvelope {
  return { v: ENVELOPE_VERSION, alg: ENVELOPE_ALG, iv: "aGVsbG8=", ciphertext: "d29ybGQ=" };
}

describe("envelope serialization", () => {
  it("round-trips a valid envelope", () => {
    const envelope = validEnvelope();
    expect(parseEnvelope(serializeEnvelope(envelope))).toEqual(envelope);
  });

  it("rejects a version it doesn't recognize", () => {
    const corrupted = { ...validEnvelope(), v: 99 };
    expect(() => parseEnvelope(JSON.stringify(corrupted))).toThrow(UnsupportedVersionError);
  });

  it("rejects an unsupported algorithm", () => {
    const corrupted = { ...validEnvelope(), alg: "DES" };
    expect(() => parseEnvelope(JSON.stringify(corrupted))).toThrow(InvalidFormatError);
  });

  it.each([
    ["not JSON at all", "{not json"],
    ["a JSON array instead of an object", "[1,2,3]"],
    ["null", "null"],
    ["missing iv", JSON.stringify({ v: ENVELOPE_VERSION, alg: ENVELOPE_ALG, ciphertext: "x" })],
    ["missing ciphertext", JSON.stringify({ v: ENVELOPE_VERSION, alg: ENVELOPE_ALG, iv: "x" })],
    ["iv is not a string", JSON.stringify({ ...validEnvelope(), iv: 123 })],
    ["empty string fields", JSON.stringify({ ...validEnvelope(), iv: "" })],
  ])("rejects corrupted data: %s", (_label, serialized) => {
    expect(() => parseEnvelope(serialized)).toThrow(InvalidFormatError);
  });
});
