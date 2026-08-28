import { describe, expect, it } from "vitest";
import { evaluatePasswordStrength, PASSWORD_CRITERIA } from "@/lib/auth/password-strength";

describe("evaluatePasswordStrength", () => {
  it("scores an empty password as 0 / molto-debole", () => {
    const result = evaluatePasswordStrength("");
    expect(result.score).toBe(0);
    expect(result.level).toBe("molto-debole");
    expect(result.satisfied).toEqual([]);
  });

  it("scores a password meeting every criterion as 5 / forte", () => {
    const result = evaluatePasswordStrength("Correct-Horse9!");
    expect(result.score).toBe(5);
    expect(result.level).toBe("forte");
    expect(result.satisfied).toHaveLength(PASSWORD_CRITERIA.length);
  });

  it("counts satisfied criteria individually", () => {
    // lowercase + number + minLength, missing uppercase and special char.
    const result = evaluatePasswordStrength("lowercase1");
    expect(result.satisfied.sort()).toEqual(["lowercase", "minLength", "number"].sort());
    expect(result.score).toBe(3);
  });

  it("caps a well-known common password at 'debole' even if shaped like a strong one", () => {
    const result = evaluatePasswordStrength("Password123!" /* not literally in the list */);
    // Sanity: this one isn't in the common list, so it should score high...
    expect(result.score).toBeGreaterThan(1);

    // ...but a password that IS in the list is capped regardless of shape.
    const common = evaluatePasswordStrength("Welcome123");
    expect(common.isCommon).toBe(true);
    expect(common.score).toBeLessThanOrEqual(1);
  });

  it("is case-insensitive when checking the common-password list", () => {
    expect(evaluatePasswordStrength("PASSWORD1").isCommon).toBe(true);
  });
});
