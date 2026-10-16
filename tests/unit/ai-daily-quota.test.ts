import { afterEach, describe, expect, it, vi } from "vitest";
import {
  aiDailyCallLimit,
  aiQuotaExceededMessage,
  consumeAiCall,
  DEFAULT_AI_DAILY_CALL_LIMIT,
  romeDay,
} from "@/lib/ai/daily-quota";

type RpcResult = { data: number | null; error: { code: string; message: string } | null };

function fakeSupabase(result: RpcResult) {
  const rpc = vi.fn().mockResolvedValue(result);
  return { client: { rpc } as unknown as Parameters<typeof consumeAiCall>[0], rpc };
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("aiDailyCallLimit", () => {
  it("uses the environment value when it is a positive integer", () => {
    expect(aiDailyCallLimit("50")).toBe(50);
  });

  it("falls back to the default for anything else", () => {
    for (const raw of [undefined, "", "0", "-3", "abc", "2.5"]) {
      expect(aiDailyCallLimit(raw)).toBe(DEFAULT_AI_DAILY_CALL_LIMIT);
    }
  });
});

describe("romeDay", () => {
  it("counts days in Rome, not in UTC", () => {
    // 22:30 UTC del 15 ottobre è già il 16 a Roma (ora legale, +2).
    expect(romeDay(new Date("2026-10-15T22:30:00Z"))).toBe("2026-10-16");
    expect(romeDay(new Date("2026-10-15T21:30:00Z"))).toBe("2026-10-15");
  });
});

describe("consumeAiCall", () => {
  it("lets the call through while under the limit, asking the database with the server's limit", async () => {
    vi.stubEnv("AI_DAILY_CALL_LIMIT", "10");
    const { client, rpc } = fakeSupabase({ data: 3, error: null });
    expect(await consumeAiCall(client)).toBeNull();
    expect(rpc).toHaveBeenCalledWith("consume_ai_call", { daily_limit: 10 });
  });

  it("answers 429 with a readable message once the limit is reached", async () => {
    vi.stubEnv("AI_DAILY_CALL_LIMIT", "10");
    const { client } = fakeSupabase({ data: -1, error: null });
    const response = await consumeAiCall(client);
    expect(response?.status).toBe(429);
    expect(await response?.json()).toEqual({ error: aiQuotaExceededMessage(10), quotaExceeded: true });
  });

  it("keeps Hinthia working if the migration is not applied yet, and says so in the log", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const { client } = fakeSupabase({ data: null, error: { code: "PGRST202", message: "not found" } });
    expect(await consumeAiCall(client)).toBeNull();
    expect(log).toHaveBeenCalled();
  });

  it("stops on any other database error: no counter, no call to Claude", async () => {
    const { client } = fakeSupabase({ data: null, error: { code: "XX000", message: "boom" } });
    expect((await consumeAiCall(client))?.status).toBe(503);
  });
});
