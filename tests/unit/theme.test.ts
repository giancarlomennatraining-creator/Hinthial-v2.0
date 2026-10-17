import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  applyStyle,
  applyTheme,
  getStoredStylePreference,
  getStoredThemePreference,
  storeStylePreference,
  storeThemePreference,
} from "@/lib/theme";

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

describe("stile", () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.removeAttribute("data-stile");
  });

  it("parte da Foglia quando non c'è nulla di salvato", () => {
    expect(getStoredStylePreference()).toBe("foglia");
  });

  it("salva e rilegge uno stile", () => {
    storeStylePreference("notte");
    expect(getStoredStylePreference()).toBe("notte");
    storeStylePreference("luce");
    expect(getStoredStylePreference()).toBe("luce");
  });

  it("ignora un valore salvato che non è uno stile e torna a Foglia", () => {
    window.localStorage.setItem("hinthial-stile", "arcobaleno");
    expect(getStoredStylePreference()).toBe("foglia");
  });

  it("applica lo stile come attributo data-stile su <html>, senza toccare il tema", () => {
    document.documentElement.classList.add("dark");
    applyStyle("notte");
    expect(document.documentElement.getAttribute("data-stile")).toBe("notte");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    applyStyle("foglia");
    expect(document.documentElement.getAttribute("data-stile")).toBe("foglia");
    document.documentElement.classList.remove("dark");
  });
});
