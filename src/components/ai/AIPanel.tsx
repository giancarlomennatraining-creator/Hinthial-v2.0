"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/db/supabase/client";
import { buildAIContext } from "@/domain/ai/context";
import { mockAIProvider } from "@/domain/ai/mock-provider";
import { answerWithClaude } from "@/domain/ai/claude-provider";
import { useAIProcessingConsent } from "@/components/ai/AIProcessingConsentProvider";
import { SourceList, SuggestionsList } from "@/components/ai/SuggestionsList";
import { useAIChat } from "@/components/ai/AIChatProvider";
import { Skeleton } from "@/components/ui/Skeleton";
import type { AIContext, AISuggestion } from "@/domain/ai/types";

/**
 * FASE 10/11 --- interfaccia AIProvider, retrieval locale, provider mock
 * (v. domain/ai/mock-provider.ts) e --- con il consenso esplicito
 * dell'utente qui sotto (v. AIProcessingConsentProvider) --- un vero
 * provider esterno (v. domain/ai/claude-provider.ts, "Explicit AI
 * processing", HINTHIAL_MVP.md sezione "HINTHIAL AI --- vincolo
 * privacy"). Senza consenso, tutto gira sul dispositivo: l'AIContext
 * viene costruito decifrando i dati con la Master Key già sbloccata, e
 * mockAIProvider non fa nessuna chiamata di rete --- nessun dato lascia
 * il browser. Con il consenso, solo la domanda e i pochi elementi
 * pertinenti trovati localmente (mai l'intero vault) vengono inviati a
 * Claude tramite la nostra route server-side.
 *
 * Il consenso vero e proprio ha due livelli (v. AIProcessingConsentProvider):
 * il "cancello" generale (masterEnabled, gestito in Impostazioni >
 * Privacy) e il consenso specifico a questa funzione (chatConsent, qui
 * sotto). Servono entrambi --- se il cancello è spento, l'interruttore
 * qui resta visibile ma disabilitato, con un rimando a dove accenderlo:
 * mai nascosto, per restare sempre chiaro dove sta girando la domanda.
 */
export function AIPanel({ masterKey }: { masterKey: CryptoKey }) {
  const supabase = useRef(createClient()).current;
  const messagesRef = useRef<HTMLDivElement>(null);

  const { messages, addMessages, clear } = useAIChat();
  const { masterEnabled, chatConsent, setChatConsent } = useAIProcessingConsent();
  const active = masterEnabled && chatConsent;

  const [context, setContext] = useState<AIContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);
  const [question, setQuestion] = useState("");
  const [suggestions, setSuggestions] = useState<AISuggestion[]>([]);
  const [consentBusy, setConsentBusy] = useState(false);
  const [consentError, setConsentError] = useState(false);

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

  async function handleAsk(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!context) return;

    const trimmed = question.trim();
    if (!trimmed) return;

    setAsking(true);
    try {
      const result = active
        ? await answerWithClaude(trimmed, context)
        : mockAIProvider.answer(trimmed, context);
      addMessages([
        { role: "user", text: trimmed },
        { role: "assistant", text: result.text, sources: result.sources },
      ]);
      setQuestion("");
    } catch (err) {
      addMessages([
        { role: "user", text: trimmed },
        {
          role: "assistant",
          text: err instanceof Error ? err.message : "Impossibile contattare l'assistente AI.",
        },
      ]);
    } finally {
      setAsking(false);
    }
  }

  async function handleConsentChange(next: boolean) {
    setConsentError(false);
    setConsentBusy(true);
    try {
      await setChatConsent(next);
    } catch {
      setConsentError(true);
    } finally {
      setConsentBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-brand">
          Assistente AI
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          {active
            ? "Fai domande sui tuoi dati. Le risposte vengono generate da Claude (Anthropic): solo la tua domanda e i pochi elementi pertinenti trovati qui sul dispositivo vengono inviati --- mai l'intero archivio."
            : "Fai domande sui tuoi dati. Risponde un motore locale, senza intelligenza artificiale vera: le tue domande vengono elaborate qui, sul tuo dispositivo --- nessun dato esce dal browser."}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-zinc-200 bg-white p-4 text-sm dark:border-zinc-800 dark:bg-zinc-950">
        <div className="min-w-0 flex-1">
          <p className="font-medium text-zinc-900 dark:text-zinc-100">
            {active ? "Risposte reali attive" : "Risposte reali disattivate"}
          </p>
          <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
            {!masterEnabled ? (
              <>
                Il consenso generale all&apos;IA reale non è attivo --- attivalo nella scheda
                Privacy di{" "}
                <Link href="/settings" className="underline underline-offset-2 hover:no-underline">
                  Impostazioni
                </Link>{" "}
                per poter accendere questa funzione.
              </>
            ) : active ? (
              "Attivando questa opzione, ogni domanda e i suoi elementi pertinenti (non l'intero archivio) vengono inviati a Claude (Anthropic) per generare la risposta."
            ) : (
              "Attiva per ricevere risposte scritte da Claude (Anthropic) invece che dal solo motore locale --- solo la domanda e i pochi elementi pertinenti trovati qui vengono inviati, mai l'intero archivio."
            )}
          </p>
          {consentError ? (
            <p role="alert" className="mt-1 text-xs text-red-600 dark:text-red-400">
              Preferenza non salvata.
            </p>
          ) : null}
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={active}
          aria-label="Risposte reali dell'assistente AI"
          disabled={consentBusy || !masterEnabled}
          onClick={() => handleConsentChange(!chatConsent)}
          className={
            active
              ? "shrink-0 rounded-xl bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-hover disabled:opacity-50"
              : "shrink-0 rounded-xl border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
          }
        >
          {active ? "Disattiva" : "Attiva risposte reali"}
        </button>
      </div>

      {error ? (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : null}

      {loading ? (
        <div role="status" aria-label="Caricamento…" className="flex flex-col gap-6">
          <div className="flex flex-col gap-2 rounded-2xl border border-zinc-200 bg-white shadow-[0_8px_20px_rgba(16,24,40,0.04)] p-4 dark:border-zinc-800 dark:bg-zinc-950">
            <Skeleton className="h-3 w-32" />
            <Skeleton className="h-3 w-full max-w-md" />
          </div>
          <div className="flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-white shadow-[0_8px_20px_rgba(16,24,40,0.04)] p-4 dark:border-zinc-800 dark:bg-zinc-950">
            <Skeleton className="h-3 w-2/3" />
            <Skeleton className="h-9 w-full" />
          </div>
        </div>
      ) : (
        <>
          <SuggestionsList suggestions={suggestions} />

          <div className="flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-white shadow-[0_8px_20px_rgba(16,24,40,0.04)] p-4 dark:border-zinc-800 dark:bg-zinc-950">
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
                className="rounded-xl bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-hover disabled:opacity-50"
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
