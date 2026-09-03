"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/db/supabase/client";
import { buildAIContext } from "@/domain/ai/context";
import { mockAIProvider } from "@/domain/ai/mock-provider";
import { SourceList, SuggestionsList } from "@/components/ai/SuggestionsList";
import { useAIChat } from "@/components/ai/AIChatProvider";
import { Skeleton } from "@/components/ui/Skeleton";
import type { AIContext, AISuggestion } from "@/domain/ai/types";

/**
 * FASE 10 --- HINTHIAL AI v0: interfaccia AIProvider, retrieval locale,
 * provider mock (v. domain/ai/). Tutto qui gira sul dispositivo:
 * l'AIContext viene costruito decifrando i dati con la Master Key già
 * sbloccata, e mockAIProvider non fa nessuna chiamata di rete --- nessun
 * dato lascia il browser. Un vero provider esterno, con consenso
 * esplicito dell'utente, arriverà in FASE 11 (v. HINTHIAL_MVP.md,
 * sezione "HINTHIAL AI --- vincolo privacy").
 */
export function AIPanel({ masterKey }: { masterKey: CryptoKey }) {
  const supabase = useRef(createClient()).current;
  const messagesRef = useRef<HTMLDivElement>(null);

  const { messages, addMessages, clear } = useAIChat();

  const [context, setContext] = useState<AIContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);
  const [question, setQuestion] = useState("");
  const [suggestions, setSuggestions] = useState<AISuggestion[]>([]);

  // Segue la conversazione verso il basso man mano che si allunga,
  // invece di lasciare l'utente sull'inizio di uno scroll interno.
  useEffect(() => {
    const container = messagesRef.current;
    if (container) container.scrollTop = container.scrollHeight;
  }, [messages]);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const built = await buildAIContext(supabase, masterKey);
      setContext(built);
      setSuggestions(mockAIProvider.suggest(built));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossibile caricare i tuoi dati.");
    } finally {
      setLoading(false);
    }
  }, [supabase, masterKey]);

  useEffect(() => {
    // See DocumentsPanel.tsx for why fetch-on-mount is legitimate here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
  }, [refresh]);

  function handleAsk(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!context) return;

    const trimmed = question.trim();
    if (!trimmed) return;

    setAsking(true);
    try {
      const result = mockAIProvider.answer(trimmed, context);
      addMessages([
        { role: "user", text: trimmed },
        { role: "assistant", text: result.text, sources: result.sources },
      ]);
      setQuestion("");
    } finally {
      setAsking(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
          Assistente AI
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Fai domande sui tuoi dati. Nella prima versione risponde un motore locale, senza
          intelligenza artificiale vera: le tue domande vengono elaborate qui, sul tuo
          dispositivo --- nessun dato esce dal browser.
        </p>
      </div>

      {error ? (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : null}

      {loading ? (
        <div role="status" aria-label="Caricamento…" className="flex flex-col gap-6">
          <div className="flex flex-col gap-2 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
            <Skeleton className="h-3 w-32" />
            <Skeleton className="h-3 w-full max-w-md" />
          </div>
          <div className="flex flex-col gap-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
            <Skeleton className="h-3 w-2/3" />
            <Skeleton className="h-9 w-full" />
          </div>
        </div>
      ) : (
        <>
          <SuggestionsList suggestions={suggestions} />

          <div className="flex flex-col gap-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
            {messages.length === 0 ? (
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Prova a chiedere, ad esempio, &quot;quali assicurazioni ho?&quot;
              </p>
            ) : (
              <>
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={clear}
                    className="text-xs font-medium text-zinc-500 underline-offset-2 hover:underline dark:text-zinc-400"
                  >
                    Nuova conversazione
                  </button>
                </div>
                <div ref={messagesRef} className="max-h-[28rem] overflow-y-auto scroll-smooth pr-1">
                  <ul className="flex flex-col gap-3">
                    {messages.map((message, i) => (
                      <li key={i} className={message.role === "user" ? "text-right" : ""}>
                        <p
                          className={
                            message.role === "user"
                              ? "inline-block whitespace-pre-wrap rounded-lg bg-brand px-3 py-2 text-sm text-white"
                              : "inline-block whitespace-pre-wrap rounded-lg bg-zinc-100 px-3 py-2 text-left text-sm text-zinc-900 dark:bg-zinc-900 dark:text-zinc-100"
                          }
                        >
                          {message.text}
                        </p>
                        {message.sources ? (
                          <div className="mt-1">
                            <SourceList sources={message.sources} />
                          </div>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </div>
              </>
            )}

            <form onSubmit={handleAsk} className="flex gap-2">
              <label htmlFor="question" className="sr-only">
                Fai una domanda
              </label>
              <input
                id="question"
                type="text"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="Fai una domanda sui tuoi dati…"
                className="flex-1 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
              />
              <button
                type="submit"
                disabled={asking || !question.trim()}
                className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-hover disabled:opacity-50"
              >
                Chiedi
              </button>
            </form>
          </div>
        </>
      )}
    </div>
  );
}
