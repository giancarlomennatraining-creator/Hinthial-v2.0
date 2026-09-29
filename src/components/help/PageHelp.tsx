"use client";

import { useRef, useState } from "react";
import { createClient } from "@/lib/db/supabase/client";
import { useMasterKey } from "@/components/crypto/MasterKeyProvider";
import { useAIProcessingConsent } from "@/components/ai/AIProcessingConsentProvider";
import { buildAIContext } from "@/domain/ai/context";
import { answerWithClaude } from "@/domain/ai/claude-provider";
import { mockAIProvider } from "@/domain/ai/mock-provider";
import { SidePanel } from "@/components/ui/SidePanel";

export interface HelpTip {
  /** Emoji, coerente con le liste puntate già in uso altrove (v. ProposalsSection). */
  icon: string;
  text: string;
}

interface HelpMessage {
  role: "user" | "assistant";
  text: string;
}

/**
 * Il pannello "Aiuto" con la voce di Hinthia (v. feedback utente): sostituisce il paragrafo descrittivo che ogni
 * pagina teneva fisso sotto il titolo. Due parti: consigli statici sempre presenti ("In breve", nessuna IA
 * coinvolta, gratis), e --- dove ha senso --- un campo per fare una domanda vera, che riusa lo stesso motore già
 * dietro /ai (stesso consenso, stesso ripiego locale senza consenso): niente cronologia condivisa con la chat
 * principale, la conversazione qui è locale al pannello e si azzera quando si lascia la pagina.
 */
export function PageHelp({
  title,
  tips,
  chatEnabled = true,
}: {
  /** Nome della pagina (o della tab), mostrato come sottotitolo nel pannello e nell'aria-label. */
  title: string;
  tips: HelpTip[];
  /** false dove chiedere a Hinthia è già l'intera pagina (v. /ai): niente sezione domanda, sarebbe ridondante. */
  chatEnabled?: boolean;
}) {
  const supabase = useRef(createClient()).current;
  const { status } = useMasterKey();
  const { masterEnabled, chatConsent } = useAIProcessingConsent();
  const active = masterEnabled && chatConsent;

  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<HelpMessage[]>([]);
  const [question, setQuestion] = useState("");
  const [asking, setAsking] = useState(false);

  async function handleAsk(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status.kind !== "unlocked") return;
    const trimmed = question.trim();
    if (!trimmed) return;

    setAsking(true);
    setMessages((prev) => [...prev, { role: "user", text: trimmed }]);
    setQuestion("");
    try {
      const context = await buildAIContext(supabase, status.masterKey);
      const result = active
        ? await answerWithClaude(trimmed, context)
        : mockAIProvider.answer(trimmed, context);
      setMessages((prev) => [...prev, { role: "assistant", text: result.text }]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", text: err instanceof Error ? err.message : "Impossibile contattare Hinthia." },
      ]);
    } finally {
      setAsking(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex shrink-0 items-center gap-2 rounded-full border-[1.5px] border-brand bg-white py-1 pl-1.5 pr-4 text-sm font-semibold text-brand shadow-[0_1px_2px_rgba(16,24,40,0.05)] hover:bg-brand/5 dark:bg-zinc-950"
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- copia ridotta dell'avatar HINTHIA, v. public/brand/README.md */}
        <img src="/brand/hinthia/hinthia-64.png" alt="" className="h-6 w-6 shrink-0 rounded-full" />
        Aiuto
      </button>

      <SidePanel open={open} onClose={() => setOpen(false)} label={`Aiuto — ${title}`}>
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- copia ridotta dell'avatar HINTHIA, v. public/brand/README.md */}
          <img src="/brand/hinthia/hinthia-128.png" alt="" className="h-11 w-11 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Hinthia</p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              {chatEnabled ? `Guida e domande su ${title}` : `Aiuto per ${title}`}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Chiudi"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-zinc-200 text-zinc-500 hover:bg-zinc-100 dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-900"
          >
            ✕
          </button>
        </div>

        <div className="flex flex-col gap-2">
          <p className="text-xs font-semibold tracking-wide text-zinc-400 uppercase">In breve</p>
          {tips.map((tip, i) => (
            <div
              key={i}
              className="flex items-center gap-2.5 rounded-xl bg-zinc-50 px-3 py-2.5 dark:bg-zinc-900"
            >
              <span aria-hidden="true">{tip.icon}</span>
              <span className="text-sm text-zinc-700 dark:text-zinc-300">{tip.text}</span>
            </div>
          ))}
        </div>

        {chatEnabled ? (
          <div className="flex flex-col gap-3 border-t border-zinc-100 pt-4 dark:border-zinc-900">
            {messages.length > 0 ? (
              <div className="flex flex-col gap-3">
                {messages.map((m, i) => (
                  <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
                    <p
                      className={
                        m.role === "user"
                          ? "max-w-[85%] rounded-2xl rounded-br-md bg-brand px-3.5 py-2 text-sm whitespace-pre-wrap text-white"
                          : "max-w-[85%] rounded-2xl rounded-bl-md bg-zinc-100 px-3.5 py-2 text-sm whitespace-pre-wrap text-zinc-900 dark:bg-zinc-900 dark:text-zinc-100"
                      }
                    >
                      {m.text}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                Hai un&apos;altra domanda?
              </p>
            )}

            {status.kind === "unlocked" ? (
              <form onSubmit={handleAsk} className="flex gap-2">
                <label htmlFor={`page-help-question-${title}`} className="sr-only">
                  Chiedi a Hinthia
                </label>
                <input
                  id={`page-help-question-${title}`}
                  type="text"
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="Chiedi a Hinthia…"
                  className="min-w-0 flex-1 rounded-full border border-zinc-300 bg-white px-4 py-2 text-sm text-zinc-950 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
                />
                <button
                  type="submit"
                  disabled={asking || !question.trim()}
                  aria-label="Invia"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand text-white hover:bg-brand-hover disabled:opacity-50"
                >
                  →
                </button>
              </form>
            ) : (
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Sblocca la master password per fare domande a Hinthia su questa pagina.
              </p>
            )}
          </div>
        ) : null}
      </SidePanel>
    </>
  );
}
