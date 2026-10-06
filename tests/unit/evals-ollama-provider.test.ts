import { describe, expect, it, vi } from "vitest";
import { createOllamaAnalysisProvider } from "../../evals/ollama-provider";
import { AnalysisOutputError, type AnalyzeBlockInput } from "@/domain/ai/analysis/types";

const INPUT: AnalyzeBlockInput = {
  block: { id: "b1", text: "[[p1]]\nPolizza RCA n. 123 scade il 12/03/2027", segmentIds: ["p1"] },
  categories: [{ id: "cat-assicurazioni", name: "Assicurazioni" }],
  vocabulary: [],
  documentType: null,
};

const OUTPUT = {
  documentType: "polizza",
  expiry: [{ value: "2027-03-12", segmentId: "p1", quote: "scade il 12/03/2027" }],
  issuer: [],
  category: [],
  fields: [],
  events: [],
  synthesis: "Una polizza.",
};

function reply(content: string, status = 200) {
  return new Response(JSON.stringify({ message: { content } }), { status });
}

describe("provider Ollama (misura)", () => {
  it("chiama la chat con lo schema come formato e legge l'oggetto JSON", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(reply(JSON.stringify(OUTPUT)));
    const provider = createOllamaAnalysisProvider({ model: "m", baseUrl: "http://h:1/", fetchImpl });

    const result = await provider.analyzeBlock(INPUT);

    expect(result.documentType).toBe("polizza");
    expect(result.expiry).toHaveLength(1);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe("http://h:1/api/chat");
    const body = JSON.parse(init.body as string);
    expect(body).toMatchObject({ model: "m", stream: false, options: { temperature: 0 } });
    expect(body.format.required).toContain("documentType");
    expect(body.messages.map((m: { role: string }) => m.role)).toEqual(["system", "user"]);
    expect(body.messages[1].content).toContain("scade il 12/03/2027");
  });

  it("riprova una volta se l'uscita non è JSON, poi fallisce con AnalysisOutputError", async () => {
    const fetchImpl = vi.fn().mockImplementation(async () => reply("{ rotto"));
    const provider = createOllamaAnalysisProvider({ model: "m", fetchImpl });
    await expect(provider.analyzeBlock(INPUT)).rejects.toBeInstanceOf(AnalysisOutputError);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("se Ollama non risponde lo dice in chiaro", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new TypeError("fetch failed"));
    const provider = createOllamaAnalysisProvider({ model: "m", fetchImpl });
    await expect(provider.analyzeBlock(INPUT)).rejects.toThrow(/Ollama non risponde.*installato e avviato/);
  });

  it("se il modello non è stato scaricato suggerisce ollama pull", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response("model not found", { status: 404 }));
    const provider = createOllamaAnalysisProvider({ model: "qwen2.5:3b", fetchImpl });
    await expect(provider.analyzeBlock(INPUT)).rejects.toThrow(/ollama pull qwen2\.5:3b/);
  });
});
