"use client";

import { useActionState } from "react";
import { verifyMfaCode } from "@/lib/auth/actions";
import { initialAuthActionState } from "@/lib/auth/action-state";
import { TextField } from "@/components/ui/TextField";
import { WebauthnLoginButton } from "@/components/auth/WebauthnLoginButton";
import type { MfaFactor } from "@/domain/mfa/types";

/** Form della pagina /login/mfa --- stesso pattern di LoginPage (server action + useActionState) per TOTP/codici di backup, più un pulsante a parte per ogni passkey registrata (v. WebauthnLoginButton). */
export function MfaChallengeForm({ webauthnFactors }: { webauthnFactors: MfaFactor[] }) {
  const [state, formAction, pending] = useActionState(verifyMfaCode, initialAuthActionState);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
          Verifica in due passaggi
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Verifica con una passkey, oppure inserisci il codice della tua app authenticator o uno
          dei tuoi codici di backup.
        </p>
      </div>

      {webauthnFactors.length > 0 ? (
        <div className="flex flex-col gap-2">
          {webauthnFactors.map((factor) => (
            <WebauthnLoginButton key={factor.id} factor={factor} />
          ))}
        </div>
      ) : null}

      {webauthnFactors.length > 0 ? (
        <div className="flex items-center gap-3 text-xs text-zinc-400 dark:text-zinc-600">
          <span className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
          oppure
          <span className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
        </div>
      ) : null}

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
          className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-hover disabled:opacity-60"
        >
          {pending ? "Verifica…" : "Verifica"}
        </button>
      </form>
    </div>
  );
}
