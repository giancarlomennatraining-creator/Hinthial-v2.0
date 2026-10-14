import { describe, expect, it } from "vitest";
import {
  ALL_STORY_QUESTIONS,
  STORY_THEMES,
  answeredQuestions,
  nextQuestion,
  sameQuestion,
  storyProgress,
} from "@/domain/stories/questions";
import { withFollowUp } from "@/domain/stories/repository";

describe("la raccolta di domande", () => {
  it("ha quattro temi, ognuno con le sue domande, tutte diverse", () => {
    expect(STORY_THEMES.map((t) => t.id)).toEqual(["storia", "per-chi-amo", "famiglia", "come-funziona"]);
    expect(ALL_STORY_QUESTIONS).toHaveLength(16);
    expect(new Set(ALL_STORY_QUESTIONS.map((q) => q.question)).size).toBe(16);
  });

  it("non chiede mai password, codici o dati bancari", () => {
    for (const { question } of ALL_STORY_QUESTIONS) {
      expect(question.toLowerCase()).not.toMatch(/password|codice pin|iban|carta di credito/);
    }
    // E il tema delle istruzioni lo dice apertamente.
    expect(STORY_THEMES.find((t) => t.id === "come-funziona")!.intro).toContain("Niente password");
  });
});

describe("sameQuestion / answeredQuestions", () => {
  it("riconosce una domanda dal titolo della nota, ignorando maiuscole e spazi", () => {
    expect(sameQuestion("  Dove sei nato? ", "dove sei nato?")).toBe(true);
    expect(sameQuestion("Dove sei nato?", "Dove vivi?")).toBe(false);
  });

  it("le domande fatte sono quelle che hanno una nota con quel titolo", () => {
    const first = STORY_THEMES[0].questions[0];
    const answered = answeredQuestions([`  ${first.toUpperCase()} `, "Una nota qualunque"]);
    expect([...answered]).toEqual([first]);
  });
});

describe("nextQuestion / storyProgress", () => {
  it("parte dalla prima domanda e salta quelle già fatte", () => {
    expect(nextQuestion(new Set())!.question).toBe(STORY_THEMES[0].questions[0]);
    const done = new Set([STORY_THEMES[0].questions[0]]);
    expect(nextQuestion(done)!.question).toBe(STORY_THEMES[0].questions[1]);
  });

  it("rispetta il tema scelto finché ci sono domande lì, poi passa al primo che ne ha", () => {
    const family = STORY_THEMES.find((t) => t.id === "famiglia")!;
    expect(nextQuestion(new Set(), "famiglia")!.theme.id).toBe("famiglia");
    const allFamilyDone = new Set(family.questions);
    expect(nextQuestion(allFamilyDone, "famiglia")!.theme.id).toBe("storia");
  });

  it("saltando una domanda si passa alla successiva, mai alla stessa, e in fondo si ricomincia", () => {
    const [q1, q2, q3] = ALL_STORY_QUESTIONS.map((q) => q.question);
    expect(nextQuestion(new Set(), undefined, q1)!.question).toBe(q2);
    expect(nextQuestion(new Set([q2]), undefined, q1)!.question).toBe(q3);
    const last = ALL_STORY_QUESTIONS[ALL_STORY_QUESTIONS.length - 1].question;
    expect(nextQuestion(new Set(), undefined, last)!.question).toBe(q1);
  });

  it("se la corrente è l'unica rimasta, saltarla la ripropone invece di non chiedere nulla", () => {
    const only = ALL_STORY_QUESTIONS[5].question;
    const done = new Set(ALL_STORY_QUESTIONS.map((q) => q.question).filter((q) => q !== only));
    expect(nextQuestion(done, undefined, only)!.question).toBe(only);
  });

  it("finite tutte, non c'è altro da chiedere", () => {
    const all = new Set(ALL_STORY_QUESTIONS.map((q) => q.question));
    expect(nextQuestion(all)).toBeNull();
    expect(storyProgress(all)).toEqual({ done: 16, total: 16 });
  });
});

describe("withFollowUp", () => {
  it("aggiunge domanda e risposta in fondo al racconto, senza righe vuote di troppo", () => {
    expect(withFollowUp("A Sassoferrato.\n\n", " Com'era la casa? ", " Aveva un pozzo. ")).toBe(
      "A Sassoferrato.\n\nCom'era la casa?\nAveva un pozzo.",
    );
  });
});
