"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/db/supabase/client";
import { buildAIContext } from "@/domain/ai/context";
import { mockAIProvider } from "@/domain/ai/mock-provider";
import { answerWithClaude } from "@/domain/ai/claude-provider";
import { useAIProcessingConsent } from "@/components/ai/AIProcessingConsentProvider";
import { SourceList } from "@/components/ai/SourceList";
import { useAIChat, type ChatMessage } from "@/components/ai/AIChatProvider";
import { Skeleton } from "@/components/ui/Skeleton";
import { Avatar } from "@/components/ui/Avatar";
import { SidePanel } from "@/components/ui/SidePanel";
import { AIConsentSettings } from "@/components/settings/AIConsentSettings";
import { SlidersIcon, ArrowRightIcon } from "@/components/icons/nav-icons";
import type { AIContext } from "@/domain/ai/types";

/**
 * FASE 10/11 --- interfaccia AIProvider, retrieval locale, provider mock
 * (v. domain/ai/mock-provider.ts) e --- con il consenso esplicito
 * dell'utente (v. AIProcessingConsentProvider, ora gestito dal pannello
 * ⚙ qui sotto, non più inline nel corpo pagina) --- un vero provider
 * esterno (v. domain/ai/claude-provider.ts, "Explicit AI processing",
 * HINTHIAL_MVP.md sezione "HINTHIAL AI --- vincolo privacy"). Senza
 * consenso, tutto gira sul dispositivo: l'AIContext viene costruito
 * decifrando i dati con la Master Key già sbloccata, e mockAIProvider
 * non fa nessuna chiamata di rete --- nessun dato lascia il browser. Con
 * il consenso, solo la domanda e i pochi elementi pertinenti trovati
 * localmente (mai l'intero vault) vengono inviati a Claude tramite la
 * nostra route server-side.
 *
 * Restyle (v. richiesta utente): il consenso vive ora in AIConsentSettings
 * dentro un SidePanel, stesso pattern del dettaglio evento in Impostazioni
 * > Attività --- niente più duplicazione della logica di consenso qui
 * dentro. "Cose da tenere d'occhio" (v. mockAIProvider.suggest(), ormai
 * rimosso) non appare più da nessuna parte: era già stata tolta dalla
 * Dashboard perché ripeteva le card sopra (v. DashboardWidgets), e
 * restava solo qui --- toglierla anche da qui l'ha eliminata come
 * funzione, scelta esplicita dell'utente, non un effetto collaterale.
 */
function initialsSeedFallback(firstName: string, lastName: string): string {
  return `${firstName} ${lastName}`.trim() || "utente";
}

interface ChatMessageGroup {
  role: ChatMessage["role"];
  messages: ChatMessage[];
}

/** Messaggi consecutivi dello stesso mittente diventano un solo gruppo visivo: un avatar, spaziatura più stretta tra le bolle. */
function groupConsecutiveMessages(messages: ChatMessage[]): ChatMessageGroup[] {
  const groups: ChatMessageGroup[] = [];
  for (const message of messages) {
    const current = groups.at(-1);
    if (current && current.role === message.role) {
      current.messages.push(message);
    } else {
      groups.push({ role: message.role, messages: [message] });
    }
  }
  return groups;
}

function formatMessageTime(createdAt: number): string {
  return new Date(createdAt).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
}

export function AIPanel({
  masterKey,
  userId,
  firstName,
  lastName,
  avatarUrl,
}: {
  masterKey: CryptoKey;
  userId: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
}) {
  const supabase = useRef(createClient()).current;
  const messagesRef = useRef<HTMLDivElement>(null);

  const { messages, addMessages, clear } = useAIChat();
  const { masterEnabled, chatConsent } = useAIProcessingConsent();
  const active = masterEnabled && chatConsent;

  const [context, setContext] = useState<AIContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);
  const [question, setQuestion] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);

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
        { role: "user", text: trimmed, createdAt: Date.now() },
        { role: "assistant", text: result.text, sources: result.sources, createdAt: Date.now() },
      ]);
      setQuestion("");
    } catch (err) {
      addMessages([
        { role: "user", text: trimmed, createdAt: Date.now() },
        {
          role: "assistant",
          text: err instanceof Error ? err.message : "Impossibile contattare l'assistente AI.",
          createdAt: Date.now(),
        },
      ]);
    } finally {
      setAsking(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className="flex items-center gap-3">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-[radial-gradient(circle,rgba(43,79,196,0.14),transparent_72%)]">
            {/* eslint-disable-next-line @next/next/no-img-element -- brand asset, not user content */}
            <img
              // Copia ridotta dell'avatar HINTHIA (v. public/brand/README.md):
              // l'originale è un PNG da 1312x1199 dentro un guscio SVG, 1,3 MB
              // --- qui ne bastano 8 KB. `alt` vuoto di proposito: è il titolo
              // accanto a dire cos'è questa pagina, ripeterlo a chi usa uno
              // screen reader aggiungerebbe rumore, non informazione.
              src="/brand/hinthia/hinthia-128.png"
              alt=""
              className="h-12 w-12 rounded-full"
            />
          </div>
          <h1 className="min-w-0 flex-1 text-2xl font-semibold tracking-tight text-brand">
            Parla con Hinthia
          </h1>
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            aria-label="Configura l'assistente AI"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-zinc-200 text-zinc-500 hover:border-brand/30 hover:bg-brand/5 hover:text-brand dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-brand/10"
          >
            <SlidersIcon width={18} height={18} />
          </button>
        </div>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          {active
            ? "Fai domande sui tuoi dati. Le risposte vengono generate da Claude (Anthropic): solo la tua domanda e i pochi elementi pertinenti trovati qui sul dispositivo vengono inviati --- mai l'intero archivio."
            : "Fai domande sui tuoi dati. Risponde un motore locale, senza intelligenza artificiale vera: le tue domande vengono elaborate qui, sul tuo dispositivo --- nessun dato esce dal browser."}
        </p>
      </div>

      {error ? (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : null}

      {loading ? (
        <div role="status" aria-label="Caricamento…" className="flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-white shadow-[0_8px_20px_rgba(16,24,40,0.04)] p-4 dark:border-zinc-800 dark:bg-zinc-950">
          <Skeleton className="h-3 w-2/3" />
          <Skeleton className="h-9 w-full" />
        </div>
      ) : (
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
                <ul className="flex flex-col gap-4">
                  {groupConsecutiveMessages(messages).map((group, gi) => (
                    <li
                      key={gi}
                      className={
                        group.role === "user"
                          ? "flex items-end justify-end gap-2"
                          : "flex items-end gap-2"
                      }
                    >
                      {group.role === "assistant" ? (
                        // eslint-disable-next-line @next/next/no-img-element -- brand asset, not user content
                        <img
                          src="/brand/hinthia/hinthia-128.png"
                          alt=""
                          className="h-7 w-7 shrink-0 rounded-full"
                        />
                      ) : null}
                      <div
                        className={
                          group.role === "user"
                            ? "flex min-w-0 max-w-[85%] flex-col items-end gap-1"
                            : "flex min-w-0 max-w-[85%] flex-col items-start gap-1"
                        }
                      >
                        {group.messages.map((message, mi) => (
                          <div
                            key={mi}
                            className={
                              group.role === "user"
                                ? "flex flex-col items-end gap-1"
                                : "flex flex-col items-start gap-1"
                            }
                          >
                            <p
                              className={
                                message.role === "user"
                                  ? "inline-block whitespace-pre-wrap rounded-2xl rounded-br-md bg-brand px-4 py-2.5 text-left text-sm text-white"
                                  : "inline-block whitespace-pre-wrap rounded-2xl rounded-bl-md bg-zinc-100 px-4 py-2.5 text-left text-sm text-zinc-900 dark:bg-zinc-900 dark:text-zinc-100"
                              }
                            >
                              {message.text}
                            </p>
                            {message.sources ? <SourceList sources={message.sources} /> : null}
                            <span className="px-1 text-[0.68rem] tabular-nums text-zinc-400 dark:text-zinc-500">
                              {formatMessageTime(message.createdAt)}
                            </span>
                          </div>
                        ))}
                      </div>
                      {group.role === "user" ? (
                        <Avatar
                          firstName={firstName}
                          lastName={lastName}
                          avatarUrl={avatarUrl}
                          seed={userId || initialsSeedFallback(firstName, lastName)}
                          size="sm"
                        />
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
              className="min-w-0 flex-1 rounded-full border border-zinc-300 bg-white px-4 py-2.5 text-sm text-zinc-950 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
            />
            <button
              type="submit"
              disabled={asking || !question.trim()}
              aria-label="Invia"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand text-white hover:bg-brand-hover disabled:opacity-50"
            >
              <ArrowRightIcon width={18} height={18} />
            </button>
          </form>
        </div>
      )}

      <SidePanel open={settingsOpen} onClose={() => setSettingsOpen(false)} label="Configura l'assistente AI">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            Configura l&apos;assistente AI
          </h2>
          <button
            type="button"
            onClick={() => setSettingsOpen(false)}
            aria-label="Chiudi"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-zinc-200 text-zinc-500 hover:bg-zinc-100 dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-900"
          >
            ✕
          </button>
        </div>
        <AIConsentSettings />
      </SidePanel>
    </div>
  );
}
