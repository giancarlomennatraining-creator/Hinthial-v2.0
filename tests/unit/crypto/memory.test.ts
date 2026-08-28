import { describe, expect, it } from "vitest";
import { wipe } from "@/lib/crypto/memory";

describe("wipe", () => {
  it("overwrites every byte with zero", () => {
    const bytes = new Uint8Array([1, 2, 3, 255, 128]);
    wipe(bytes);
    expect(bytes).toEqual(new Uint8Array([0, 0, 0, 0, 0]));
  });

  it("is a no-op on an empty array", () => {
    const bytes = new Uint8Array([]);
    expect(() => wipe(bytes)).not.toThrow();
  });
});
