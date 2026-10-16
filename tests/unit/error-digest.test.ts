import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ErrorDigestRow } from "@/lib/email/templates";

const sendEmail = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/email/send-email", () => ({ sendEmail: (...args: unknown[]) => sendEmail(...args) }));

const { sendErrorDigest } = await import("@/lib/errors/digest");

type Row = ErrorDigestRow & { id: string };

/** Un database finto con le sole catene che usa sendErrorDigest. */
function fakeAdmin(rows: Row[]) {
  const calls = { deletedBefore: "", markedIds: [] as string[] };
  const admin = {
    from: () => ({
      delete: () => ({
        lt: async (_column: string, value: string) => {
          calls.deletedBefore = value;
          return { error: null };
        },
      }),
      select: () => ({
        is: () => ({ order: () => ({ limit: async () => ({ data: rows, error: null }) }) }),
      }),
      update: () => ({
        in: async (_column: string, ids: string[]) => {
          calls.markedIds = ids;
          return { error: null };
        },
      }),
    }),
  };
  return { admin: admin as unknown as Parameters<typeof sendErrorDigest>[0], calls };
}

const row = (id: string): Row => ({
  id,
  source: "server",
  kind: "Error (route)",
  message: "boom",
  path: "/api/x",
  digest: null,
  count: 2,
  first_seen: "2026-10-16T08:00:00Z",
  last_seen: "2026-10-16T09:00:00Z",
});

beforeEach(() => sendEmail.mockClear());
afterEach(() => vi.unstubAllEnvs());

describe("sendErrorDigest", () => {
  it("sends one email with the new errors and marks them as sent", async () => {
    vi.stubEnv("ERROR_ALERT_EMAIL", "ops@example.com");
    const { admin, calls } = fakeAdmin([row("a"), row("b")]);

    expect(await sendErrorDigest(admin)).toEqual({ groups: 2, sent: true });
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(sendEmail.mock.calls[0][0]).toMatchObject({ to: "ops@example.com", subject: "Hinthial: 2 errori nuovi in produzione" });
    expect(calls.markedIds).toEqual(["a", "b"]);
  });

  it("sends nothing when there is nothing new", async () => {
    vi.stubEnv("ERROR_ALERT_EMAIL", "ops@example.com");
    const { admin } = fakeAdmin([]);
    expect(await sendErrorDigest(admin)).toEqual({ groups: 0, sent: false });
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("without a recipient keeps the errors for later instead of marking them", async () => {
    vi.stubEnv("ERROR_ALERT_EMAIL", "");
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const { admin, calls } = fakeAdmin([row("a")]);
    expect(await sendErrorDigest(admin)).toEqual({ groups: 1, sent: false });
    expect(sendEmail).not.toHaveBeenCalled();
    expect(calls.markedIds).toEqual([]);
  });

  it("forgets errors older than 90 days", async () => {
    vi.stubEnv("ERROR_ALERT_EMAIL", "ops@example.com");
    const { admin, calls } = fakeAdmin([]);
    await sendErrorDigest(admin);
    const expected = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    expect(calls.deletedBefore).toBe(expected);
  });
});
