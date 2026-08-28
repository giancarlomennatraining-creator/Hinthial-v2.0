import { describe, expect, it } from "vitest";
import {
  base64ToBytes,
  bytesToBase64,
  bytesToUtf8,
  utf8ToBytes,
} from "@/lib/crypto/codec";

describe("codec", () => {
  it("round-trips bytes through base64", () => {
    const original = new Uint8Array([0, 1, 2, 254, 255, 128, 42]);
    expect(base64ToBytes(bytesToBase64(original))).toEqual(original);
  });

  it("round-trips text through utf8 bytes, including non-ASCII", () => {
    const text = "città è bella — 你好";
    expect(bytesToUtf8(utf8ToBytes(text))).toBe(text);
  });

  it("throws a clear error for invalid base64 input", () => {
    expect(() => base64ToBytes("not valid base64 !!!")).toThrow();
  });
});
