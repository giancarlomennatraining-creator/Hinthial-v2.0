import { describe, expect, it } from "vitest";
import { resolveSettingsTarget, searchSettings, SETTINGS_ENTRIES } from "@/components/settings/settings-index";

describe("resolveSettingsTarget", () => {
  it("riconosce le pagine nuove e un blocco indicato", () => {
    expect(resolveSettingsTarget("security", "activity")).toEqual({ tab: "security", block: "activity" });
    expect(resolveSettingsTarget("data")).toEqual({ tab: "data", block: null });
  });

  it("traduce i vecchi indirizzi", () => {
    expect(resolveSettingsTarget("activity")).toEqual({ tab: "security", block: "activity" });
    expect(resolveSettingsTarget("user-info")).toEqual({ tab: "profile", block: null });
    expect(resolveSettingsTarget("ai")).toEqual({ tab: "privacy", block: "hinthia" });
    expect(resolveSettingsTarget("appearance", "capsules")).toEqual({ tab: "preferences", block: "capsule-effect" });
    expect(resolveSettingsTarget("appearance", "archive")).toEqual({ tab: "data", block: "trash" });
  });

  it("ignora ciò che non esiste", () => {
    expect(resolveSettingsTarget("boh")).toBeNull();
    expect(resolveSettingsTarget(undefined)).toBeNull();
  });
});

describe("searchSettings", () => {
  it("trova per nome e per parole chiave, senza badare ad accenti e maiuscole", () => {
    expect(searchSettings("cestino")[0].block).toBe("trash");
    expect(searchSettings("IMPRONTA")[0].block).toBe("trusted-devices");
    expect(searchSettings("attivita")[0].block).toBe("activity");
  });

  it("chiede tutte le parole", () => {
    expect(searchSettings("tema scuro").map((e) => e.block)).toContain("theme");
    expect(searchSettings("tema xyz")).toEqual([]);
  });

  it("non cerca nulla con il campo vuoto", () => {
    expect(searchSettings("  ")).toEqual([]);
  });

  it("ogni voce ha un nome e un blocco", () => {
    for (const e of SETTINGS_ENTRIES) {
      expect(e.label).not.toBe("");
      expect(e.block).toBeTruthy();
    }
  });
});
