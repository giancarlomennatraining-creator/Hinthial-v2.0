import { describe, expect, it } from "vitest";
import { INTRO_INIT_SCRIPT, INTRO_SEEN_KEY, shouldPlayIntro } from "@/lib/app-intro";

const base = { search: "", seen: false, standalone: true, reducedMotion: false };

describe("shouldPlayIntro", () => {
  it("la prima apertura dell'app installata sì", () => {
    expect(shouldPlayIntro(base)).toBe(true);
  });

  it("le volte dopo no", () => {
    expect(shouldPlayIntro({ ...base, seen: true })).toBe(false);
  });

  it("in una scheda del browser no", () => {
    expect(shouldPlayIntro({ ...base, standalone: false })).toBe(false);
  });

  it("chi ha chiesto meno movimento non la vede, nemmeno forzata", () => {
    expect(shouldPlayIntro({ ...base, reducedMotion: true })).toBe(false);
    expect(shouldPlayIntro({ ...base, search: "?intro=1", reducedMotion: true })).toBe(false);
  });

  it("?intro=1 la mostra comunque, ?intro=0 la salta sempre", () => {
    expect(shouldPlayIntro({ ...base, search: "?intro=1", seen: true, standalone: false })).toBe(true);
    expect(shouldPlayIntro({ ...base, search: "?x=2&intro=1" , seen: true, standalone: false })).toBe(true);
    expect(shouldPlayIntro({ ...base, search: "?intro=0" })).toBe(false);
  });

  it("non confonde ?intro=10 con ?intro=1", () => {
    expect(shouldPlayIntro({ ...base, search: "?intro=10", seen: true })).toBe(false);
  });
});

describe("INTRO_INIT_SCRIPT", () => {
  /** Esegue lo script in una pagina finta e dice se ha messo data-intro. */
  function run(input: { search: string; seen: boolean; standalone: boolean; reducedMotion: boolean }): boolean {
    const attrs: Record<string, string> = {};
    const fakeWindow = {
      location: { search: input.search },
      matchMedia: (q: string) => ({
        matches: q.includes("reduced-motion") ? input.reducedMotion : q.includes("display-mode: standalone") ? input.standalone : false,
      }),
      navigator: {},
      localStorage: { getItem: (k: string) => (k === INTRO_SEEN_KEY && input.seen ? "1" : null) },
    };
    const fakeDocument = { referrer: "", documentElement: { setAttribute: (k: string, v: string) => (attrs[k] = v) } };
    new Function("window", "document", "location", "localStorage", INTRO_INIT_SCRIPT.replace(/window\.navigator/g, "window.navigator"))(
      fakeWindow,
      fakeDocument,
      fakeWindow.location,
      fakeWindow.localStorage,
    );
    return attrs["data-intro"] === "1";
  }

  it("applica la stessa regola dello script della pagina", () => {
    const cases = [
      { search: "", seen: false, standalone: true, reducedMotion: false },
      { search: "", seen: true, standalone: true, reducedMotion: false },
      { search: "", seen: false, standalone: false, reducedMotion: false },
      { search: "", seen: false, standalone: true, reducedMotion: true },
      { search: "?intro=1", seen: true, standalone: false, reducedMotion: false },
      { search: "?intro=1", seen: true, standalone: false, reducedMotion: true },
      { search: "?intro=0", seen: false, standalone: true, reducedMotion: false },
    ];
    for (const c of cases) expect(run(c), JSON.stringify(c)).toBe(shouldPlayIntro(c));
  });
});
