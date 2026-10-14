import { describe, expect, it } from "vitest";
import { continuityScore, continuitySteps } from "@/domain/continuity/steps";

const NOTHING = {
  guardianCount: 0,
  legacyEnabled: false,
  emergencyCardFilled: false,
  capsulesForOthers: 0,
  capsulesForDelivery: 0,
};

describe("continuitySteps", () => {
  it("senza nulla di fatto, i quattro passi dicono cosa manca e dove farlo", () => {
    const steps = continuitySteps(NOTHING);
    expect(steps.map((s) => s.id)).toEqual(["guardians", "legacy", "emergency-card", "capsules"]);
    expect(steps.every((s) => !s.done)).toBe(true);
    expect(steps.map((s) => s.href)).toEqual(["/friends", "/legacy", "/legacy", "/capsules/new"]);
    expect(continuityScore(steps)).toEqual({ done: 0, total: 4 });
  });

  it("ogni passo si completa da solo", () => {
    expect(continuityScore(continuitySteps({ ...NOTHING, guardianCount: 2 }))).toEqual({ done: 1, total: 4 });
    expect(continuityScore(continuitySteps({ ...NOTHING, legacyEnabled: true }))).toEqual({ done: 1, total: 4 });
    expect(continuityScore(continuitySteps({ ...NOTHING, emergencyCardFilled: true }))).toEqual({ done: 1, total: 4 });
    expect(
      continuityScore(continuitySteps({ ...NOTHING, capsulesForOthers: 1, capsulesForDelivery: 1 })),
    ).toEqual({ done: 1, total: 4 });
  });

  it("le capsule contano solo se si aprono anche prima, alla consegna: una capsula con la sola data non basta", () => {
    const dateOnly = continuitySteps({ ...NOTHING, capsulesForOthers: 2 }).find((s) => s.id === "capsules")!;
    expect(dateOnly.done).toBe(false);
    expect(dateOnly.label).toBe("Nessuna capsula si apre prima della sua data: scegli quali");
    // Le capsule ci sono già: manca solo scegliere quali, e si fa nella pagina Eredità digitale.
    expect(dateOnly.href).toBe("/legacy");
    expect(dateOnly.action).toBe("Scegli");

    const none = continuitySteps(NOTHING).find((s) => s.id === "capsules")!;
    expect(none.label).toBe("Nessuna capsula per chi ami: scrivine una");
    expect(none.href).toBe("/capsules/new");
  });

  it("con tutto fatto il punteggio è pieno e le frasi parlano al singolare o al plurale", () => {
    const one = continuitySteps({
      guardianCount: 1,
      legacyEnabled: true,
      emergencyCardFilled: true,
      capsulesForOthers: 1,
      capsulesForDelivery: 1,
    });
    expect(continuityScore(one)).toEqual({ done: 4, total: 4 });
    expect(one[0].label).toBe("Hai un guardiano che può confermare la tua assenza");
    expect(one[3].label).toBe("Una capsula arriverà a chi ami anche se non ci sei");

    const many = continuitySteps({
      guardianCount: 3,
      legacyEnabled: true,
      emergencyCardFilled: true,
      capsulesForOthers: 5,
      capsulesForDelivery: 5,
    });
    expect(many[0].label).toBe("Hai 3 guardiani che possono confermare la tua assenza");
    expect(many[3].label).toBe("5 capsule arriveranno a chi ami anche se non ci sei");
  });
});
