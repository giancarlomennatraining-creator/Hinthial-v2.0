import { describe, expect, it } from "vitest";
import {
  INTRO_INIT_SCRIPT,
  INTRO_MODE_KEY,
  INTRO_SEEN_KEY,
  INTRO_SESSION_KEY,
  parseIntroMode,
  shouldPlayIntro,
  type IntroInput,
} from "@/lib/app-intro";

const base: IntroInput = {
  search: "",
  mode: "always",
  seen: false,
  seenThisSession: false,
  standalone: true,
  reducedMotion: false,
};

describe("parseIntroMode", () => {
  it("parte da 'a ogni apertura' senza una scelta valida", () => {
    expect(parseIntroMode(null)).toBe("always");
    expect(parseIntroMode("boh")).toBe("always");
    expect(parseIntroMode("first")).toBe("first");
    expect(parseIntroMode("never")).toBe("never");
  });
});

describe("shouldPlayIntro", () => {
  it("a ogni apertura: la prima volta di questa apertura sì, poi non finché non si richiude l'app", () => {
    expect(shouldPlayIntro(base)).toBe(true);
    expect(shouldPlayIntro({ ...base, seenThisSession: true })).toBe(false);
    // L'averla vista in passato non conta: a ogni apertura è a ogni apertura.
    expect(shouldPlayIntro({ ...base, seen: true })).toBe(true);
  });

  it("solo la prima volta: dopo non più, anche in un'altra apertura", () => {
    expect(shouldPlayIntro({ ...base, mode: "first" })).toBe(true);
    expect(shouldPlayIntro({ ...base, mode: "first", seen: true })).toBe(false);
  });

  it("mai: mai", () => {
    expect(shouldPlayIntro({ ...base, mode: "never" })).toBe(false);
  });

  it("in una scheda del browser non compare da sola", () => {
    expect(shouldPlayIntro({ ...base, standalone: false })).toBe(false);
  });

  it("chi ha chiesto meno movimento non la vede, nemmeno forzata", () => {
    expect(shouldPlayIntro({ ...base, reducedMotion: true })).toBe(false);
    expect(shouldPlayIntro({ ...base, search: "?intro=1", reducedMotion: true })).toBe(false);
  });

  it("?intro=1 la mostra comunque (anche con 'mai'), ?intro=0 la salta sempre", () => {
    expect(shouldPlayIntro({ ...base, search: "?intro=1", seenThisSession: true, standalone: false, mode: "never" })).toBe(true);
    expect(shouldPlayIntro({ ...base, search: "?x=2&intro=1", standalone: false })).toBe(true);
    expect(shouldPlayIntro({ ...base, search: "?intro=0" })).toBe(false);
  });

  it("non confonde ?intro=10 con ?intro=1", () => {
    expect(shouldPlayIntro({ ...base, search: "?intro=10", seenThisSession: true })).toBe(false);
  });
});

describe("INTRO_INIT_SCRIPT", () => {
  /** Esegue lo script in una pagina finta e dice se ha messo data-intro. */
  function run(input: IntroInput): boolean {
    const attrs: Record<string, string> = {};
    const fakeWindow = {
      matchMedia: (q: string) => ({
        matches: q.includes("reduced-motion") ? input.reducedMotion : q.includes("display-mode: standalone") ? input.standalone : false,
      }),
      navigator: {},
    };
    const fakeDocument = { referrer: "", documentElement: { setAttribute: (k: string, v: string) => (attrs[k] = v) } };
    const localStorage = {
      getItem: (k: string) => (k === INTRO_MODE_KEY ? input.mode : k === INTRO_SEEN_KEY && input.seen ? "1" : null),
    };
    const sessionStorage = { getItem: (k: string) => (k === INTRO_SESSION_KEY && input.seenThisSession ? "1" : null) };
    new Function("window", "document", "location", "localStorage", "sessionStorage", INTRO_INIT_SCRIPT)(
      fakeWindow,
      fakeDocument,
      { search: input.search },
      localStorage,
      sessionStorage,
    );
    return attrs["data-intro"] === "1";
  }

  it("applica la stessa regola dello script della pagina, in ogni combinazione", () => {
    const searches = ["", "?intro=1", "?intro=0"];
    const modes = ["always", "first", "never"] as const;
    for (const search of searches)
      for (const mode of modes)
        for (const seen of [false, true])
          for (const seenThisSession of [false, true])
            for (const standalone of [false, true])
              for (const reducedMotion of [false, true]) {
                const c: IntroInput = { search, mode, seen, seenThisSession, standalone, reducedMotion };
                expect(run(c), JSON.stringify(c)).toBe(shouldPlayIntro(c));
              }
  });
});
