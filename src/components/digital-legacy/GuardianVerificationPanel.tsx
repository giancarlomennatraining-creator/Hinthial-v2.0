"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/db/supabase/client";
import {
  getGuardianVerificationRequest,
  respondToGuardianVerificationRequest,
  type GuardianVerificationRequestView,
  type GuardianVerificationResponse,
} from "@/domain/digital-legacy/guardians";

/**
 * FASE 12, coinvolgimento guardiani --- dove porta il link nell'email
 * di richiesta (v. lib/email/templates.ts, digitalLegacyGuardianRequestEmail).
 * Niente RequireMasterKey: risposta e nome del proprietario sono già
 * in chiaro (v. domain/digital-legacy/guardians.ts), nessun dato del
 * vault coinvolto.
 */
export function GuardianVerificationPanel({ requestId }: { requestId: string }) {
  const [supabase] = useState(() => createClient());
  const [request, setRequest] = useState<GuardianVerificationRequestView | null | "loading">("loading");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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
      <div className="flex max-w-sm flex-col gap-2">
        <h1 className="text-xl font-semibold text-brand">Richiesta non trovata</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Questo link non esiste più --- se pensi sia un errore, contatta direttamente la persona
          che ti ha indicato come guardiano.
        </p>
      </div>
    );
  }

  if (request.response) {
    return (
      <div className="flex max-w-sm flex-col gap-2">
        <h1 className="text-xl font-semibold text-brand">✓ Grazie della risposta</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          {request.response === "ok"
            ? `Hai confermato di avere notizie di ${request.ownerName}: la verifica su Hinthial si ferma qui.`
            : request.response === "unreachable"
              ? `Hai confermato di non riuscire a raggiungere ${request.ownerName}. Puoi chiudere questa pagina.`
              : `Hai indicato di non saperlo, per ${request.ownerName}. Puoi chiudere questa pagina.`}
        </p>
        <button
          type="button"
          onClick={() => setRequest({ ...request, response: null })}
          className="mt-2 w-fit text-sm font-medium text-brand hover:underline"
        >
          Cambia risposta
        </button>
      </div>
    );
  }

  return (
    <div className="flex max-w-sm flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold text-brand">Riesci a raggiungere {request.ownerName}?</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          {request.ownerName} ti ha indicato come guardiano su Hinthial. Non riusciamo a
          contattarlo/la da un po&apos; di tempo, nonostante diversi promemoria --- puoi dirci se
          hai sue notizie?
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => handleRespond("ok")}
          className="rounded-xl bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-hover disabled:opacity-50"
        >
          Sì, sta bene
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => handleRespond("unknown")}
          className="rounded-xl border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
        >
          Non lo so
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => handleRespond("unreachable")}
          className="rounded-xl border border-red-300 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950"
        >
          Confermo che non riesco a raggiungerlo/la
        </button>
      </div>

      {error ? (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : null}
    </div>
  );
}
