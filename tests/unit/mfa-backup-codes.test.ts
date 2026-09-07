import { describe, expect, it } from "vitest";
import {
  generateBackupCode,
  generateBackupCodes,
  hashBackupCode,
  normalizeBackupCode,
} from "@/domain/mfa/backup-codes";

describe("generateBackupCode", () => {
  it("produces a code in the form XXXXX-XXXXX using only unambiguous characters", () => {
    const code = generateBackupCode();
    expect(code).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{5}-[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{5}$/);
  });

  it("generateBackupCodes returns the requested count, all distinct in practice", () => {
    const codes = generateBackupCodes(10);
    expect(codes).toHaveLength(10);
    expect(new Set(codes).size).toBe(10);
  });
});

describe("normalizeBackupCode", () => {
  it("strips the dash and uppercases, so a code verifies the same with or without formatting", () => {
    expect(normalizeBackupCode("ab3d9-k7m2q")).toBe("AB3D9K7M2Q");
    expect(normalizeBackupCode("AB3D9K7M2Q")).toBe("AB3D9K7M2Q");
    expect(normalizeBackupCode(" AB3D9-K7M2Q ")).toBe("AB3D9K7M2Q");
  });
});

describe("hashBackupCode", () => {
  it("is deterministic and normalizes before hashing", async () => {
    const a = await hashBackupCode("AB3D9-K7M2Q");
    const b = await hashBackupCode("ab3d9k7m2q");
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });

  it("different codes hash differently", async () => {
    const a = await hashBackupCode(generateBackupCode());
    const b = await hashBackupCode(generateBackupCode());
    expect(a).not.toBe(b);
  });
});
