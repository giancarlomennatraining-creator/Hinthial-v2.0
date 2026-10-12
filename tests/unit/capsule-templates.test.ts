import { describe, expect, it } from "vitest";
import {
  appendPrompt,
  CAPSULE_TEMPLATES,
  GENERIC_PROMPTS,
  isPromptUsed,
  promptsFor,
  suggestedOpenAt,
  templateMeta,
} from "@/domain/capsules/templates";

describe("i modelli di capsula", () => {
  it("hanno identificativi e nomi diversi, e tutto il necessario", () => {
    expect(new Set(CAPSULE_TEMPLATES.map((t) => t.id)).size).toBe(CAPSULE_TEMPLATES.length);
    expect(new Set(CAPSULE_TEMPLATES.map((t) => t.name)).size).toBe(CAPSULE_TEMPLATES.length);
    for (const template of CAPSULE_TEMPLATES) {
      expect(template.title.trim(), template.id).not.toBe("");
      expect(template.openHint.trim(), template.id).not.toBe("");
      expect(template.prompts.length, template.id).toBeGreaterThan(0);
      expect(new Set(template.prompts).size, template.id).toBe(template.prompts.length);
      expect(template.attachmentIdeas.length, template.id).toBeGreaterThan(0);
    }
  });

  it("nessuno spunto contiene i due punti: serve a riconoscerlo già usato", () => {
    for (const prompt of [...GENERIC_PROMPTS, ...CAPSULE_TEMPLATES.flatMap((t) => t.prompts)]) {
      expect(prompt).not.toContain(":");
    }
  });

  it("dicono quanti spunti hanno, e senza modello valgono gli spunti generici", () => {
    expect(templateMeta(CAPSULE_TEMPLATES[0])).toBe(`${CAPSULE_TEMPLATES[0].prompts.length} spunti per scrivere`);
    expect(promptsFor(null)).toBe(GENERIC_PROMPTS);
    expect(promptsFor(CAPSULE_TEMPLATES[1])).toBe(CAPSULE_TEMPLATES[1].prompts);
  });
});

describe("suggestedOpenAt", () => {
  const now = new Date(2026, 9, 11, 15, 42, 30);

  it("propone la stessa data di N anni dopo, alle 10:00 ora locale", () => {
    const template = CAPSULE_TEMPLATES.find((t) => t.id === "me-stesso")!;
    const result = new Date(suggestedOpenAt(template, now)!);
    expect(result.getFullYear()).toBe(2031);
    expect(result.getMonth()).toBe(9);
    expect(result.getDate()).toBe(11);
    expect(result.getHours()).toBe(10);
    expect(result.getMinutes()).toBe(0);
  });

  it("non propone nulla se la data dipende dalla persona", () => {
    const template = CAPSULE_TEMPLATES.find((t) => t.id === "diciotto")!;
    expect(suggestedOpenAt(template, now)).toBeNull();
  });

  it("non cambia l'orario che gli si passa", () => {
    const template = CAPSULE_TEMPLATES.find((t) => t.id === "bambino")!;
    const copy = new Date(now);
    suggestedOpenAt(template, copy);
    expect(copy.getTime()).toBe(now.getTime());
  });
});

describe("appendPrompt", () => {
  it("su una lettera vuota mette lo spunto da completare", () => {
    expect(appendPrompt("", "Cosa spero per te")).toBe("Cosa spero per te: ");
  });

  it("dopo il testo scrive lo spunto in un nuovo paragrafo, senza spazi in più", () => {
    expect(appendPrompt("Caro Marco,  \n", "Cosa spero per te")).toBe("Caro Marco,\n\nCosa spero per te: ");
  });

  it("lo spunto aggiunto risulta usato, anche dopo averci scritto", () => {
    const content = appendPrompt("Ciao", "Cosa spero per te") + "che tu sia felice";
    expect(isPromptUsed(content, "Cosa spero per te")).toBe(true);
    expect(isPromptUsed(content, "Un consiglio che avrei voluto ricevere")).toBe(false);
  });
});
