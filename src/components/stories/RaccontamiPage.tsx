"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AudioVideoRecorder } from "@/components/media/AudioVideoRecorder";
import { useSupabase } from "@/lib/db/supabase/use-supabase";
import { useAIProcessingConsent } from "@/components/ai/AIProcessingConsentProvider";
import { PageHelp } from "@/components/help/PageHelp";
import { starterHref } from "@/domain/capsules/starter";
import { askFollowUp } from "@/domain/stories/follow-up";
import {
  STORY_THEMES,
  answeredQuestions,
  nextQuestion,
  storyProgress,
  type StoryTheme,
} from "@/domain/stories/questions";
import {
  appendFollowUp,
  listStories,
  loadVoiceStory,
  saveStory,
  saveVoiceStory,
  type Story,
} from "@/domain/stories/repository";
import { formatDate } from "@/lib/format";
import { cn, errorMessage } from "@/lib/utils";
import { BTN_PRIMARY, BTN_SECONDARY, INPUT_FIELD, PANEL, PANEL_FLAT } from "@/components/ui/styles";
import { ErrorText } from "@/components/ui/ErrorText";
import { LoadingText } from "@/components/ui/LoadingText";

type Current = { theme: StoryTheme; question: string };

/**
 * "Raccontami": Hinthia ti fa una domanda alla volta su ciò che sai e che non sta in nessun documento. Ogni risposta
 * diventa una nota cifrata in Archivio (categoria "Racconti") che puoi far arrivare a chi vuoi con "Fallo arrivare a…".
 * Con il consenso a Hinthia, dopo la risposta arriva anche una domanda di approfondimento (v. app/api/ai/follow-up):
 * senza, restano le domande scritte e nulla lascia il dispositivo. Si può anche rispondere a voce: la registrazione diventa
 * un racconto audio cifrato, senza trascrizione e quindi senza domanda di approfondimento.
 */
export function RaccontamiPage({ masterKey }: { masterKey: CryptoKey }) {
  const supabase = useSupabase();
  const { masterEnabled, chatConsent } = useAIProcessingConsent();
  const canFollowUp = masterEnabled && chatConsent;

  const [stories, setStories] = useState<Story[] | null>(null);
  const [current, setCurrent] = useState<Current | null>(null);
  const [answer, setAnswer] = useState("");
  // Scrivere o parlare: la scelta resta per le domande successive.
  const [mode, setMode] = useState<"write" | "voice">("write");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Dopo il salvataggio: il racconto scritto, e (se c'è il consenso) la domanda di approfondimento di Hinthia.
  const [saved, setSaved] = useState<Story | null>(null);
  const [followUp, setFollowUp] = useState<{ status: "loading" | "ready" | "failed"; question: string } | null>(null);
  const [followUpAnswer, setFollowUpAnswer] = useState("");
  const [followUpDone, setFollowUpDone] = useState(false);

  const answered = useMemo(() => answeredQuestions((stories ?? []).map((s) => s.question)), [stories]);
  const progress = storyProgress(answered);

  const refresh = useCallback(async () => {
    const loaded = await listStories(supabase, masterKey);
    setStories(loaded);
    return loaded;
  }, [supabase, masterKey]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const loaded = await listStories(supabase, masterKey);
        if (cancelled) return;
        setStories(loaded);
        setCurrent(nextQuestion(answeredQuestions(loaded.map((s) => s.question))));
      } catch (err) {
        if (!cancelled) setError(errorMessage(err, "Impossibile caricare i racconti."));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase, masterKey]);

  function resetAnswering(next: Current | null) {
    setCurrent(next);
    setAnswer("");
    setSaved(null);
    setFollowUp(null);
    setFollowUpAnswer("");
    setFollowUpDone(false);
    setError(null);
  }

  async function handleSave() {
    if (!current || !answer.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Devi essere autenticato.");

      const id = await saveStory(supabase, masterKey, user.id, { question: current.question, answer });
      const loaded = await refresh();
      const story = loaded.find((s) => s.id === id) ?? null;
      setSaved(story);

      if (story && canFollowUp) {
        setFollowUp({ status: "loading", question: "" });
        try {
          const question = await askFollowUp(current.question, answer);
          setFollowUp({ status: "ready", question });
        } catch {
          // Il racconto è già salvato: senza la domanda di Hinthia si prosegue lo stesso.
          setFollowUp({ status: "failed", question: "" });
        }
      }
    } catch (err) {
      setError(errorMessage(err, "Impossibile salvare il racconto."));
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveVoice(recording: File) {
    if (!current) return;
    setSaving(true);
    setError(null);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Devi essere autenticato.");

      const id = await saveVoiceStory(supabase, masterKey, user.id, { question: current.question, recording });
      const loaded = await refresh();
      setSaved(loaded.find((s) => s.id === id) ?? null);
    } catch (err) {
      setError(errorMessage(err, "Impossibile salvare il racconto a voce."));
    } finally {
      setSaving(false);
    }
  }

  async function handleAddFollowUp() {
    if (!saved || !followUp || followUp.status !== "ready" || !followUpAnswer.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Devi essere autenticato.");
      await appendFollowUp(supabase, masterKey, user.id, saved, { question: followUp.question, answer: followUpAnswer });
      setFollowUpDone(true);
      await refresh();
    } catch (err) {
      setError(errorMessage(err, "Impossibile aggiungere la risposta al racconto."));
    } finally {
      setSaving(false);
    }
  }

  /** `skip`: salta la domanda corrente senza rispondere, e la prossima è quella che la segue (non la stessa). */
  function goNext(themeId?: string, skip = false) {
    // Il racconto appena salvato conta già come fatto anche se l'elenco non si è ancora aggiornato.
    const done = new Set(answered);
    if (saved) done.add(saved.question);
    resetAnswering(nextQuestion(done, themeId, skip ? current?.question : undefined));
  }

  const writing = current !== null && saved === null;
  const finished = saved !== null && (followUp === null || followUp.status === "failed" || followUpDone);

  return (
    <div className="flex flex-col gap-8 pb-[calc(3rem+env(safe-area-inset-bottom))] sm:pb-0">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-title">Raccontami</h1>
          <p className="mt-1 max-w-2xl text-sm text-zinc-500 dark:text-zinc-400">
            Ci sono cose che sai solo tu e che non stanno in nessun documento. Ti faccio una domanda alla volta: le risposte
            restano tue, cifrate, e puoi farle arrivare a chi vuoi.
          </p>
        </div>
        <PageHelp
          title="Raccontami"
          tips={[
            { icon: "📖", text: "Ogni risposta diventa una nota nella categoria Racconti dell'Archivio." },
            { icon: "🎙️", text: "Puoi anche rispondere a voce: la registrazione resta cifrata e la ascolti solo tu, finché non la fai arrivare a qualcuno." },
            { icon: "💌", text: "Da ogni racconto puoi aprire una capsula per farlo arrivare a una persona." },
            { icon: "🤖", text: "Con Hinthia attiva, dopo la risposta ti faccio una domanda in più per ricordare un dettaglio. Senza, le domande sono quelle scritte." },
            { icon: "🔑", text: "Non scrivere password: per quelle servono altri posti." },
          ]}
        />
      </div>

      <div className="flex flex-wrap gap-2" role="group" aria-label="Temi">
        {STORY_THEMES.map((theme) => {
          const done = theme.questions.filter((q) => answered.has(q)).length;
          const active = current?.theme.id === theme.id;
          return (
            <button
              key={theme.id}
              type="button"
              aria-pressed={active}
              disabled={saving || !stories}
              onClick={() => goNext(theme.id)}
              className={cn(
                "rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors disabled:opacity-50",
                active
                  ? "border-brand bg-brand text-white"
                  : "border-zinc-300 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900",
              )}
            >
              {theme.name} · {done}/{theme.questions.length}
            </button>
          );
        })}
      </div>

      {error ? (
        <ErrorText>
          {error}
        </ErrorText>
      ) : null}

      {stories === null ? (
        error ? null : <LoadingText />
      ) : current === null && saved === null ? (
        <section aria-label="Domanda" className={`${PANEL_FLAT} p-5`}>
          <h2 className="text-lg font-extrabold text-zinc-900 dark:text-zinc-100">Hai risposto a tutte le domande</h2>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            {progress.total} racconti: complimenti. Puoi rileggerli e farli arrivare a chi vuoi.
          </p>
        </section>
      ) : (
        <section aria-label="Domanda" className={`${PANEL} flex flex-col gap-4 p-5`}>
          {writing && current ? (
            <>
              <div>
                <p className="text-xs font-bold tracking-wider text-accent uppercase">{current.theme.name}</p>
                <h2 className="mt-1 text-xl leading-snug font-extrabold text-zinc-900 dark:text-zinc-100">{current.question}</h2>
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{current.theme.intro}</p>
              </div>
              <div role="group" aria-label="Come vuoi rispondere" className="flex w-fit gap-1 rounded-full border border-zinc-200 p-1 dark:border-zinc-800">
                {(
                  [
                    ["write", "✍️ Scrivi"],
                    ["voice", "🎙️ Racconta a voce"],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={mode === value}
                    disabled={saving}
                    onClick={() => setMode(value)}
                    className={cn(
                      "rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors disabled:opacity-50",
                      mode === value ? "bg-brand text-white" : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900",
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {mode === "voice" ? (
                <div className="flex flex-col gap-2">
                  <AudioVideoRecorder
                    kinds={["audio"]}
                    onRecorded={handleSaveVoice}
                    title="Racconta a voce"
                    description="Parla come se avessi davanti chi lo ascolterà. La registrazione resta sul tuo dispositivo finché non la salvi, poi è cifrata come le note."
                    confirmLabel="Salva il racconto"
                  />
                  {saving ? (
                    <p role="status" className="text-sm text-zinc-600 dark:text-zinc-400">
                      Salvataggio…
                    </p>
                  ) : null}
                  {canFollowUp ? (
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      Hinthia non ascolta le registrazioni: la domanda in più arriva solo con le risposte scritte.
                    </p>
                  ) : null}
                </div>
              ) : (
                <div className="flex flex-col gap-1">
                  <label htmlFor="story-answer" className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                    La tua risposta
                  </label>
                  <textarea
                    id="story-answer"
                    rows={7}
                    value={answer}
                    onChange={(e) => setAnswer(e.target.value)}
                    placeholder="Scrivi come parleresti: non serve che sia bello."
                    className={INPUT_FIELD}
                  />
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    {canFollowUp
                      ? "Salvandola, Hinthia la legge per farti una domanda in più. Il racconto resta cifrato."
                      : "Resta cifrata e la vedi solo tu. Per ricevere anche una domanda di approfondimento, attiva Hinthia in Impostazioni."}
                  </p>
                </div>
              )}
              <div className="flex flex-wrap gap-3">
                {mode === "write" ? (
                  <button type="button" onClick={handleSave} disabled={saving || !answer.trim()} className={`${BTN_PRIMARY} disabled:opacity-50`}>
                    {saving ? "Salvataggio…" : "Salva il racconto"}
                  </button>
                ) : null}
                <button type="button" onClick={() => goNext(undefined, true)} disabled={saving} className={`${BTN_SECONDARY} disabled:opacity-50`}>
                  Un&apos;altra domanda
                </button>
              </div>
            </>
          ) : saved ? (
            <>
              <div>
                <p className="text-xs font-bold tracking-wider text-green-700 uppercase dark:text-green-400">
                  {saved.voice ? "Racconto a voce salvato" : "Racconto salvato"}
                </p>
                <h2 className="mt-1 text-xl leading-snug font-extrabold text-zinc-900 dark:text-zinc-100">{saved.question}</h2>
              </div>

              {followUp?.status === "loading" ? (
                <p role="status" className="text-sm text-zinc-600 dark:text-zinc-400">
                  Hinthia ci sta pensando…
                </p>
              ) : followUp?.status === "ready" && !followUpDone ? (
                <div className="flex flex-col gap-2 rounded-xl bg-brand/10 p-4">
                  <p className="text-xs font-bold tracking-wider text-accent uppercase">Hinthia chiede</p>
                  <p className="text-base font-semibold text-zinc-900 dark:text-zinc-100">{followUp.question}</p>
                  <label htmlFor="story-follow-up" className="sr-only">
                    La tua risposta alla domanda di Hinthia
                  </label>
                  <textarea
                    id="story-follow-up"
                    rows={4}
                    value={followUpAnswer}
                    onChange={(e) => setFollowUpAnswer(e.target.value)}
                    className={INPUT_FIELD}
                  />
                  <div className="flex flex-wrap gap-3">
                    <button type="button" onClick={handleAddFollowUp} disabled={saving || !followUpAnswer.trim()} className={`${BTN_PRIMARY} disabled:opacity-50`}>
                      {saving ? "Salvataggio…" : "Aggiungi al racconto"}
                    </button>
                    <button type="button" onClick={() => setFollowUpDone(true)} disabled={saving} className={BTN_SECONDARY}>
                      Basta così
                    </button>
                  </div>
                </div>
              ) : null}

              {finished ? (
                <div className="flex flex-col gap-3">
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">
                    Lo trovi in Archivio, nella categoria Racconti.
                    {followUpDone && followUpAnswer.trim() ? " La risposta in più è stata aggiunta." : ""}
                  </p>
                  <div className="flex flex-wrap gap-3">
                    <Link href={starterHref("documento", saved.id)} className={BTN_PRIMARY}>
                      Fallo arrivare a…
                    </Link>
                    <button type="button" onClick={() => goNext()} className={BTN_SECONDARY}>
                      Prossima domanda
                    </button>
                  </div>
                </div>
              ) : null}
            </>
          ) : null}
        </section>
      )}

      {stories && stories.length > 0 ? (
        <section aria-labelledby="stories-title" className="flex flex-col gap-3">
          <h2 id="stories-title" className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            I tuoi racconti
          </h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {progress.done} {progress.done === 1 ? "domanda raccontata" : "domande raccontate"} su {progress.total}.
          </p>
          <ul className={`${PANEL_FLAT} flex flex-col divide-y divide-zinc-200 dark:divide-zinc-800`}>
            {stories.map((story) => (
              <li key={story.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <span className="flex min-w-0 flex-col gap-0.5">
                  <Link href={`/archive/${story.id}`} className="truncate text-sm font-medium text-zinc-900 hover:text-accent dark:text-zinc-100">
                    {story.question}
                  </Link>
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">
                    {story.voice ? "🎙️ a voce · " : ""}raccontato il {formatDate(story.createdAt)}
                  </span>
                </span>
                <span className="flex shrink-0 flex-wrap items-center gap-3">
                  {story.voice ? <VoicePlayer story={story} masterKey={masterKey} /> : null}
                  <Link href={starterHref("documento", story.id)} className="text-xs font-semibold text-accent hover:underline">
                    Fallo arrivare a…
                  </Link>
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

/** "Ascolta": il racconto a voce si decifra solo quando lo si chiede, poi suona qui. */
function VoicePlayer({ story, masterKey }: { story: Story; masterKey: CryptoKey }) {
  const supabase = useSupabase();
  const [url, setUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "failed">("idle");

  useEffect(
    () => () => {
      if (url) URL.revokeObjectURL(url);
    },
    [url],
  );

  async function load() {
    setStatus("loading");
    try {
      setUrl(URL.createObjectURL(await loadVoiceStory(supabase, masterKey, story)));
      setStatus("idle");
    } catch {
      setStatus("failed");
    }
  }

  if (url) {
    return <audio src={url} controls autoPlay aria-label={`Racconto a voce: ${story.question}`} className="h-9 w-56 max-w-full" />;
  }
  return (
    <button type="button" onClick={load} disabled={status === "loading"} className="text-xs font-semibold text-accent hover:underline disabled:opacity-50">
      {status === "loading" ? "Apro…" : status === "failed" ? "Non riesco ad aprirlo: riprova" : "▶ Ascolta"}
    </button>
  );
}
