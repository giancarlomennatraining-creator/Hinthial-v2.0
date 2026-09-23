/**
 * Cestino --- i due calcoli puri di data. `computePurgeAt` in
 * particolare merita test dedicati: è l'unico punto da cui dipende la
 * promessa "cambiare il periodo non è retroattivo" (v. migrazione
 * 20260923000000) --- una volta calcolato, non deve più muoversi.
 */
import { describe, expect, it } from "vitest";
import { computePurgeAt, daysRemaining } from "@/domain/documents/trash";

describe("computePurgeAt", () => {
  it("adds exactly N days to the deletion moment", () => {
    const deletedAt = new Date("2026-09-23T10:00:00Z");
    expect(computePurgeAt(deletedAt, 15).toISOString()).toBe("2026-10-08T10:00:00.000Z");
  });

  it("supports every allowed retention option", () => {
    const deletedAt = new Date("2026-01-01T00:00:00Z");
    expect(computePurgeAt(deletedAt, 5).getUTCDate()).toBe(6);
    expect(computePurgeAt(deletedAt, 30).toISOString()).toBe("2026-01-31T00:00:00.000Z");
  });
});

describe("daysRemaining", () => {
  it("counts whole days left, rounded up", () => {
    const now = new Date("2026-09-23T12:00:00Z");
    const purgeAt = new Date("2026-09-25T18:00:00Z"); // 2 giorni e 6 ore
    expect(daysRemaining(purgeAt, now)).toBe(3);
  });

  it("never goes negative for an already-expired document", () => {
    const now = new Date("2026-09-23T12:00:00Z");
    const purgeAt = new Date("2026-09-20T00:00:00Z"); // già scaduto
    expect(daysRemaining(purgeAt, now)).toBe(0);
  });

  it("is zero right at the exact purge moment", () => {
    const now = new Date("2026-09-23T12:00:00Z");
    expect(daysRemaining(now, now)).toBe(0);
  });
});
