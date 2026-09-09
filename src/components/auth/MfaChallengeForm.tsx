"use client";

import { useActionState } from "react";
import { verifyMfaCode } from "@/lib/auth/actions";
import { initialAuthActionState } from "@/lib/auth/action-state";
import { TextField } from "@/components/ui/TextField";

/** Form della pagina /login/mfa --- stesso pattern di LoginPage (server action + useActionState). Un solo campo per il codice TOTP o un codice di backup: verifyMfaCode prova entrambi. */
export function MfaChallengeForm() {
  const [state, formAction, pending] = useActionState(verifyMfaCode, initialAuthActionState);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
          Verifica in due passaggi
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Inserisci il codice della tua app authenticator, oppure uno dei tuoi codici di backup.
        </p>
      </div>

      <form action={formAction} className="flex flex-col gap-4">
        <TextField
          id="code"
          name="code"
          label="Codice a 6 cifre o di backup"
          type="text"
          inputMode="text"
          autoComplete="one-time-code"
          required
        />

        {state.error ? (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {state.error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={pending}
          className="rounded-xl bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-hover disabled:opacity-60"
        >
          {pending ? "Verifica…" : "Verifica"}
        </button>
      </form>
    </div>
  );
}
