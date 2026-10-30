/**
 * La domanda di approfondimento di Silva (v. app/api/ai/follow-up/route.ts). Solo il browser la chiama e solo con il
 * consenso attivo: il server lo riverifica comunque. Se non riesce, il racconto è già salvato e si prosegue senza.
 */
export async function askFollowUp(question: string, answer: string): Promise<string> {
  const response = await fetch("/api/ai/follow-up", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question, answer }),
  });
  const data = (await response.json().catch(() => ({}))) as { text?: string; error?: string };
  if (!response.ok || !data.text) {
    throw new Error(data.error ?? "Silva non è riuscita a farti una domanda.");
  }
  return data.text;
}
