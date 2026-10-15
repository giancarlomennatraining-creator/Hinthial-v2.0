import { describe, expect, it } from "vitest";
import {
  afterAnswerText,
  firstNameOf,
  guardianAnswers,
  unreachableConsequence,
} from "@/domain/digital-legacy/guardian-answers";

describe("le parole per il guardiano", () => {
  it("si rivolge alla persona per nome, il primo", () => {
    expect(firstNameOf("Marta Rossi")).toBe("Marta");
    expect(firstNameOf("  Marta  ")).toBe("Marta");
    expect(firstNameOf("questo account")).toBe("questo");
  });

  it("tre risposte, nell'ordine: ho notizie, non lo so, non riesco a raggiungere", () => {
    const answers = guardianAnswers("Marta Rossi");
    expect(answers.map((a) => a.value)).toEqual(["ok", "unknown", "unreachable"]);
    expect(answers[0].label).toBe("Sì, ho notizie di Marta");
    expect(answers[2].label).toBe("Non riesco a raggiungere Marta");
  });

  it("ogni risposta dice prima cosa provoca", () => {
    const [ok, unknown, unreachable] = guardianAnswers("Marta Rossi");
    expect(ok.effect).toMatch(/Tutto si ferma subito/);
    expect(unknown.effect).toMatch(/non sposta niente/);
    expect(unreachable.effect).toMatch(/ti chiederemo di confermare/);
  });

  it("prima di confermare l'assenza dice che può portare alla consegna, e che un accesso ferma tutto", () => {
    const text = unreachableConsequence("Marta Rossi");
    expect(text).toContain("le capsule che ha preparato si apriranno");
    expect(text).toContain("Un suo accesso, in qualsiasi momento, ferma tutto.");
  });

  it("dopo la risposta dice cosa succederà", () => {
    expect(afterAnswerText("ok", "Marta Rossi")).toMatch(/si ferma qui/);
    expect(afterAnswerText("unknown", "Marta Rossi")).toMatch(/cambia la risposta/);
    expect(afterAnswerText("unreachable", "Marta Rossi")).toMatch(/ho sue notizie" ferma tutto/);
  });

  it("niente 'lo/la' nei testi", () => {
    const all = [
      ...guardianAnswers("Marta Rossi").flatMap((a) => [a.label, a.effect]),
      unreachableConsequence("Marta Rossi"),
      afterAnswerText("ok", "Marta"),
      afterAnswerText("unknown", "Marta"),
      afterAnswerText("unreachable", "Marta"),
    ];
    for (const text of all) expect(text).not.toMatch(/lo\/la/);
  });
});
