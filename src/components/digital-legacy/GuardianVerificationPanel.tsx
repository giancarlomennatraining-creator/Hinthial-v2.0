"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSupabase } from "@/lib/db/supabase/use-supabase";
import {
  getGuardianVerificationRequest,
  respondToGuardianVerificationRequest,
  type GuardianVerificationRequestView,
  type GuardianVerificationResponse,
} from "@/domain/digital-legacy/guardians";
import {
  afterAnswerText,
  firstNameOf,
  guardianAnswers,
  unreachableConsequence,
} from "@/domain/digital-legacy/guardian-answers";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { BTN_SECONDARY } from "@/components/ui/styles";

/**
 * Dove porta la richiesta "hai notizie di …?" (dall'email, v. lib/email/templates.ts, o dal riquadro in Oggi e Protetti,
 * v. PendingGuardianChecks). È il momento più delicato per chi la riceve: prima di rispondere dice cosa provoca ogni
 * risposta (v. domain/digital-legacy/guardian-answers.ts), chiede una conferma esplicita per "non riesco a raggiungerla",
 * che è quella che porta alla consegna, e dopo dice cosa succederà. Niente RequireMasterKey: risposta e nome sono in chiaro,
 * nessun dato del vault coinvolto.
 */
export function GuardianVerificationPanel({ requestId }: { requestId: string }) {
  const supabase = useSupabase();
  const [request, setRequest] = useState<GuardianVerificationRequestView | null | "loading">("loading");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // "Non riesco a raggiungere": prima una conferma, con le conseguenze scritte.
  const [confirmingUnreachable, setConfirmingUnreachable] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const found = await getGuardianVerificationRequest(supabase, requestId);
        if (!cancelled) setRequest(found);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Impossibile leggere la richiesta.");
          setRequest(null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase, requestId]);

  async function handleRespond(response: GuardianVerificationResponse) {
    if (request === "loading" || !request) return;
    setError(null);
    setBusy(true);
    try {
      await respondToGuardianVerificationRequest(supabase, requestId, response);
      setRequest({ ...request, response });
      setConfirmingUnreachable(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossibile registrare la risposta. Riprova.");
    } finally {
      setBusy(false);
    }
  }

  if (request === "loading") {
    return <p className="text-sm text-zinc-500 dark:text-zinc-400">Caricamento…</p>;
  }

  if (!request) {
    return (
      <div className="flex max-w-lg flex-col gap-2">
        <h1 className="text-xl font-semibold text-title">Richiesta non trovata</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Questa richiesta non è più attiva. Di solito vuol dire che la persona che ti aveva scelto è tornata ad accedere, oppure
          che un altro guardiano ha confermato di avere sue notizie. Non devi fare altro.
        </p>
        <Link href="/dashboard" className="mt-2 w-fit text-sm font-medium text-accent hover:underline">
          Vai a Oggi
        </Link>
      </div>
    );
  }

  const name = firstNameOf(request.ownerName);
  const errorNote = error ? (
    <p role="alert" className="text-sm text-red-600 dark:text-red-400">
      {error}
    </p>
  ) : null;

  if (request.response) {
    return (
      <div className="flex max-w-lg flex-col gap-3">
        <p className="text-xs font-bold tracking-wider text-green-700 uppercase dark:text-green-400">Risposta registrata</p>
        <h1 className="font-heading text-2xl font-extrabold text-zinc-900 dark:text-zinc-100">Grazie</h1>
        <p className="text-sm text-zinc-700 dark:text-zinc-300">{afterAnswerText(request.response, request.ownerName)}</p>
        <div className="mt-1 flex flex-wrap gap-3">
          <button type="button" onClick={() => setRequest({ ...request, response: null })} className={BTN_SECONDARY}>
            Cambia risposta
          </button>
          <Link href="/dashboard" className="self-center text-sm font-medium text-accent hover:underline">
            Vai a Oggi
          </Link>
        </div>
        {errorNote}
      </div>
    );
  }

  if (confirmingUnreachable) {
    return (
      <div className="flex max-w-lg flex-col gap-4">
        <div>
          <p className="text-xs font-bold tracking-wider text-red-700 uppercase dark:text-red-400">Prima di confermare</p>
          <h1 className="mt-1 font-heading text-2xl font-extrabold text-zinc-900 dark:text-zinc-100">
            Non riesci a raggiungere {name}?
          </h1>
        </div>
        <p className="text-sm text-zinc-700 dark:text-zinc-300">{unreachableConsequence(request.ownerName)}</p>
        <p className="text-sm text-zinc-700 dark:text-zinc-300">
          Se hai ancora un modo per provare (una telefonata, un messaggio, qualcuno della sua famiglia), prova prima.
        </p>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            disabled={busy}
            onClick={() => handleRespond("unreachable")}
            className="rounded-xl bg-red-700 px-4 py-2 text-sm font-medium text-white hover:bg-red-800 disabled:opacity-50"
          >
            Confermo: non riesco a raggiungere {name}
          </button>
          <button type="button" disabled={busy} onClick={() => setConfirmingUnreachable(false)} className={BTN_SECONDARY}>
            Torna indietro
          </button>
        </div>
        {errorNote}
      </div>
    );
  }

  return (
    <div className="flex max-w-lg flex-col gap-5">
      <div>
        <p className="text-xs font-bold tracking-wider text-accent uppercase">Sei la persona di fiducia di {name}</p>
        <h1 className="mt-1 font-heading text-2xl font-extrabold text-zinc-900 dark:text-zinc-100">Hai notizie di {name}?</h1>
        <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-300">
          {request.ownerName} ti ha scelto come guardiano su Hinthial. Da molto tempo non accede e non ha risposto ai nostri
          promemoria. Prima di fare qualsiasi cosa, chiediamo a te. Te lo chiediamo dal {formatDate(request.createdAt)}.
        </p>
      </div>

      <div className="rounded-xl bg-brand/10 p-4 text-sm text-zinc-800 dark:text-zinc-200">
        <p className="font-semibold">Prima di rispondere</p>
        <p className="mt-1">
          Prova a sentire {name}: una telefonata, un messaggio, qualcuno della sua famiglia. Non c&apos;è fretta: puoi rispondere
          quando ne sai di più, e cambiare risposta in seguito.
        </p>
      </div>

      <div role="group" aria-label="La tua risposta" className="flex flex-col gap-2">
        {guardianAnswers(request.ownerName).map((answer) => (
          <button
            key={answer.value}
            type="button"
            disabled={busy}
            onClick={() => (answer.value === "unreachable" ? setConfirmingUnreachable(true) : handleRespond(answer.value))}
            className={cn(
              "flex flex-col items-start gap-0.5 rounded-xl border p-4 text-left transition-colors disabled:opacity-50",
              answer.value === "ok"
                ? "border-brand bg-white hover:bg-brand/5 dark:bg-zinc-950"
                : answer.value === "unreachable"
                  ? "border-red-300 bg-white hover:bg-red-50 dark:border-red-900 dark:bg-zinc-950 dark:hover:bg-red-950/40"
                  : "border-zinc-300 bg-white hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-950 dark:hover:bg-zinc-900",
            )}
          >
            <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{answer.label}</span>
            <span className="text-xs text-zinc-600 dark:text-zinc-400">{answer.effect}</span>
          </button>
        ))}
      </div>

      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        Non vedi nulla dei contenuti di {name}, né ora né dopo: Hinthial ti chiede solo questo. Se ha preparato qualcosa per
        te, lo riceverai come le altre persone a cui l&apos;ha destinato.
      </p>
      {errorNote}
    </div>
  );
}
