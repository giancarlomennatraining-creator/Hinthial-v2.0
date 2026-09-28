/**
 * FASE 22: Claude a volte avvolge il JSON richiesto in un blocco markdown ``` (o ```json) nonostante il prompt
 * gli chieda di non farlo --- tolto quello, e con un'ultima difesa che prende solo la porzione tra la prima "{" e
 * l'ultima "}", il parsing tollera anche una frase introduttiva che il modello a volte aggiunge comunque.
 */
export function parseClaudeJson(raw: string): unknown {
  const withoutFences = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/, "")
    .trim();

  try {
    return JSON.parse(withoutFences);
  } catch {
    const start = withoutFences.indexOf("{");
    const end = withoutFences.lastIndexOf("}");
    if (start === -1 || end === -1 || end < start) throw new Error("Nessun JSON trovato nella risposta.");
    return JSON.parse(withoutFences.slice(start, end + 1));
  }
}
