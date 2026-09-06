"use client";

import { useActionState } from "react";
import { verifyMfaCode } from "@/lib/auth/actions";
import { initialAuthActionState } from "@/lib/auth/action-state";
import { TextField } from "@/components/ui/TextField";

/** Form della pagina /login/mfa --- stesso pattern di LoginPage (server action + useActionState). */
export function MfaChallengeForm() {
  const [state, formAction, pending] = useActionState(verifyMfaCode, initialAuthActionState);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
          Verifica in due passaggi
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Inserisci il codice a 6 cifre mostrato dalla tua app authenticator.
        </p>
      </div>

      <form action={formAction} className="flex flex-col gap-4">
        <TextField
          id="code"
          name="code"
          label="Codice a 6 cifre"
          type="text"
          inputMode="numeric"
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
          className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-hover disabled:opacity-60"
        >
          {pending ? "Verifica…" : "Verifica"}
        </button>
      </form>
    </div>
  );
}
