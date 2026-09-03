import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { applyTheme, getStoredThemePreference, storeThemePreference } from "@/lib/theme";

function mockMatchMedia(prefersDark: boolean) {
  window.matchMedia = vi.fn().mockReturnValue({
    matches: prefersDark,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }) as unknown as typeof window.matchMedia;
}

describe("theme", () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.classList.remove("dark");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("defaults to 'system' when nothing is stored", () => {
    expect(getStoredThemePreference()).toBe("system");
  });

  it("round-trips a stored preference", () => {
    storeThemePreference("dark");
    expect(getStoredThemePreference()).toBe("dark");
  });

  it("ignores a corrupted stored value and falls back to 'system'", () => {
    window.localStorage.setItem("hinthial-theme", "not-a-real-theme");
    expect(getStoredThemePreference()).toBe("system");
  });

  it("applies the dark class for an explicit 'dark' preference regardless of system", () => {
    mockMatchMedia(false);
    applyTheme("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("never applies the dark class for an explicit 'light' preference, even if the system prefers dark", () => {
    mockMatchMedia(true);
    applyTheme("light");
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  it("follows the system preference for 'system'", () => {
    mockMatchMedia(true);
    applyTheme("system");
    expect(document.documentElement.classList.contains("dark")).toBe(true);

    mockMatchMedia(false);
    applyTheme("system");
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });
});
