import { beforeEach, describe, expect, it } from "vitest";
import {
  clearMockSession,
  createMockSession,
  getMockSession,
} from "@/lib/auth/mock-session";

describe("mock-session", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("returns null when no session has been created", () => {
    expect(getMockSession()).toBeNull();
  });

  it("persists and reads back a created session", () => {
    createMockSession({ email: "a@example.com", displayName: "Ada" });
    expect(getMockSession()).toEqual({
      email: "a@example.com",
      displayName: "Ada",
    });
  });

  it("replaces an existing session on re-creation", () => {
    createMockSession({ email: "a@example.com", displayName: "Ada" });
    createMockSession({ email: "b@example.com", displayName: "Bob" });
    expect(getMockSession()).toEqual({
      email: "b@example.com",
      displayName: "Bob",
    });
  });

  it("returns null after clearing the session", () => {
    createMockSession({ email: "a@example.com", displayName: "Ada" });
    clearMockSession();
    expect(getMockSession()).toBeNull();
  });

  it("returns null for malformed data in storage", () => {
    window.localStorage.setItem("hinthial.mock-session.v1", "not json");
    expect(getMockSession()).toBeNull();
  });

  it("returns null for well-formed JSON missing the expected shape", () => {
    window.localStorage.setItem(
      "hinthial.mock-session.v1",
      JSON.stringify({ foo: "bar" }),
    );
    expect(getMockSession()).toBeNull();
  });
});
