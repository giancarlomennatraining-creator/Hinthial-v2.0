import { beforeEach, describe, expect, it } from "vitest";
import { backTarget } from "@/lib/back-target";
import { recordNavigation, referringPath, resetNavigationHistory } from "@/lib/navigation-history";

const PARENT = { href: "/archive", label: "Torna all'archivio" };

describe("backTarget", () => {
  it("senza una pagina di provenienza resta il genitore (apertura diretta, ricarica)", () => {
    expect(backTarget(null, "/archive/abc", PARENT)).toEqual(PARENT);
  });

  it("torna alla pagina da cui si arriva, col suo nome", () => {
    expect(backTarget("/dossiers/d1", "/archive/abc", PARENT)).toEqual({ href: "/dossiers/d1", label: "Torna al fascicolo" });
    expect(backTarget("/dashboard", "/archive/abc", PARENT)).toEqual({ href: "/dashboard", label: "Torna a Oggi" });
    expect(backTarget("/capsules", "/archive/abc", PARENT)).toEqual({ href: "/capsules", label: "Torna alle capsule" });
    expect(backTarget("/archive/trash", "/archive/abc", PARENT)).toEqual({ href: "/archive/trash", label: "Torna al cestino" });
    expect(backTarget("/archive/zzz", "/archive/abc", PARENT)).toEqual({ href: "/archive/zzz", label: "Torna al documento" });
  });

  it("non torna mai a un modulo, a se stessa o a una pagina non prevista", () => {
    expect(backTarget("/archive/new", "/archive/abc", PARENT)).toEqual(PARENT);
    expect(backTarget("/archive/import", "/archive/abc", PARENT)).toEqual(PARENT);
    expect(backTarget("/dossiers/new", "/archive/abc", PARENT)).toEqual(PARENT);
    expect(backTarget("/dossiers/d1/edit", "/archive/abc", PARENT)).toEqual(PARENT);
    expect(backTarget("/archive/abc", "/archive/abc", PARENT)).toEqual(PARENT);
    expect(backTarget("/settings", "/archive/abc", PARENT)).toEqual(PARENT);
    expect(backTarget("/login", "/archive/abc", PARENT)).toEqual(PARENT);
  });
});

describe("navigation-history", () => {
  beforeEach(() => resetNavigationHistory());

  it("ricorda la pagina da cui si arriva, sia prima sia dopo che la nuova è stata registrata", () => {
    expect(referringPath("/dashboard")).toBeNull();
    recordNavigation("/dashboard");
    // Durante il render della pagina nuova il tracker non ha ancora registrato: la vecchia è in `current`.
    expect(referringPath("/archive/abc")).toBe("/dashboard");
    recordNavigation("/archive/abc");
    expect(referringPath("/archive/abc")).toBe("/dashboard");
  });

  it("una pagina registrata due volte di fila (un re-render) non cancella la provenienza", () => {
    recordNavigation("/dossiers/d1");
    recordNavigation("/archive/abc");
    recordNavigation("/archive/abc");
    expect(referringPath("/archive/abc")).toBe("/dossiers/d1");
  });
});
