import { describe, expect, it } from "vitest";
import { parseClaudeJson } from "@/lib/ai/parse-claude-json";

describe("parseClaudeJson", () => {
  it("interpreta JSON puro", () => {
    expect(parseClaudeJson('{"a": 1}')).toEqual({ a: 1 });
  });

  it("toglie un blocco markdown ```json ... ```", () => {
    expect(parseClaudeJson('```json\n{"a": 1}\n```')).toEqual({ a: 1 });
  });

  it("toglie un blocco markdown ``` senza 'json'", () => {
    expect(parseClaudeJson('```\n{"a": 1}\n```')).toEqual({ a: 1 });
  });

  it("recupera il JSON anche con una frase introduttiva davanti", () => {
    expect(parseClaudeJson('Ecco il risultato:\n{"a": 1}')).toEqual({ a: 1 });
  });

  it("lancia se non trova nessun JSON", () => {
    expect(() => parseClaudeJson("non c'è alcun JSON qui")).toThrow();
  });
});
