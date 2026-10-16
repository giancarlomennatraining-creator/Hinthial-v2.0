import { afterEach, describe, expect, it, vi } from "vitest";
import { formatSize } from "@/lib/format";
import {
  assertStorageRoom,
  getMyStorageUsage,
  quotaErrorOrNull,
  StorageQuotaError,
  storageQuotaMessage,
  wouldExceedQuota,
} from "@/lib/storage/quota";

const GB = 1024 * 1024 * 1024;

type RpcResult = { data: unknown; error: { code: string; message: string } | null };

function fakeSupabase(result: RpcResult) {
  return { rpc: vi.fn().mockResolvedValue(result) } as unknown as Parameters<typeof getMyStorageUsage>[0];
}

const usageRow = (used: number, quota: number) => ({ data: [{ used_bytes: used, quota_bytes: quota }], error: null });

afterEach(() => vi.restoreAllMocks());

describe("formatSize", () => {
  it("speaks in GB from one gigabyte up", () => {
    expect(formatSize(2 * GB)).toBe("2.0 GB");
    expect(formatSize(512 * 1024 * 1024)).toBe("512.0 MB");
  });
});

describe("wouldExceedQuota", () => {
  it("lets a file in only if it fits entirely", () => {
    expect(wouldExceedQuota({ usedBytes: 90, quotaBytes: 100 }, 10)).toBe(false);
    expect(wouldExceedQuota({ usedBytes: 90, quotaBytes: 100 }, 11)).toBe(true);
  });
});

describe("storageQuotaMessage", () => {
  it("says how much space there is and how to free it", () => {
    expect(storageQuotaMessage(2 * GB)).toBe(
      "Hai finito lo spazio a disposizione (2.0 GB). Per fare posto svuota il Cestino o elimina i contenuti che non ti servono più.",
    );
  });
});

describe("getMyStorageUsage", () => {
  it("reads used space and quota from the database", async () => {
    expect(await getMyStorageUsage(fakeSupabase(usageRow(10, 100)))).toEqual({ usedBytes: 10, quotaBytes: 100 });
  });

  it("returns null when the migration is not applied yet, without noise in the log", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await getMyStorageUsage(fakeSupabase({ data: null, error: { code: "PGRST202", message: "x" } }))).toBeNull();
    expect(log).not.toHaveBeenCalled();
  });
});

describe("assertStorageRoom", () => {
  it("throws a readable error before uploading a file that does not fit", async () => {
    await expect(assertStorageRoom(fakeSupabase(usageRow(95, 100)), 10)).rejects.toBeInstanceOf(StorageQuotaError);
    await expect(assertStorageRoom(fakeSupabase(usageRow(95, 100)), 5)).resolves.toBeUndefined();
  });

  it("lets the database decide when the space cannot be read", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(
      assertStorageRoom(fakeSupabase({ data: null, error: { code: "XX000", message: "rete" } }), 10),
    ).resolves.toBeUndefined();
  });
});

describe("quotaErrorOrNull", () => {
  it("turns the database refusal into the readable message when the space is full", async () => {
    const error = await quotaErrorOrNull(fakeSupabase(usageRow(100, 100)), {
      message: "new row violates row-level security policy",
    });
    expect(error).toBeInstanceOf(StorageQuotaError);
  });

  it("leaves other errors alone", async () => {
    expect(await quotaErrorOrNull(fakeSupabase(usageRow(10, 100)), { message: "new row violates row-level security policy" })).toBeNull();
    expect(await quotaErrorOrNull(fakeSupabase(usageRow(100, 100)), { message: "The resource already exists" })).toBeNull();
  });
});
