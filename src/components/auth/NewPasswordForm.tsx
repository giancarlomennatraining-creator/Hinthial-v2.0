"use client";

import { useActionState, useState } from "react";
import { resetPassword } from "@/lib/auth/actions";
import { initialAuthActionState } from "@/lib/auth/action-state";
import { TextField } from "@/components/ui/TextField";
import { PasswordStrengthMeter } from "@/components/ui/PasswordStrengthMeter";

/** Il form della nuova password. Chi ha l'autenticazione a due fattori deve inserire anche il codice: senza, Supabase non permette di cambiare la password. */
export function NewPasswordForm({ requiresMfa }: { requiresMfa: boolean }) {
  const [state, formAction, pending] = useActionState(resetPassword, initialAuthActionState);
  const [password, setPassword] = useState("");
  // Controllati: React svuota i campi non controllati dopo ogni invio, e un campo vuoto e `required` bloccherebbe il nuovo tentativo senza dire perché.
  const [confirmPassword, setConfirmPassword] = useState("");
  const [code, setCode] = useState("");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-brand">Imposta una nuova password</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Codice verificato. Scegli una nuova password per il tuo account.
        </p>
      </div>

      <form action={formAction} className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <TextField
            id="password"
            name="password"
            label="Nuova password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            variant="halo"
            required
          />
          <PasswordStrengthMeter password={password} />
        </div>
        <TextField
          id="confirmPassword"
          name="confirmPassword"
          label="Conferma nuova password"
          type="password"
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          variant="halo"
          required
        />

        {requiresMfa ? (
          <div className="flex flex-col gap-1">
            <TextField
              id="code"
              name="code"
              label="Codice a 6 cifre o di backup"
              type="text"
              inputMode="text"
              autoComplete="one-time-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              variant="halo"
              required
            />
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Hai attivato la verifica in due passaggi: inserisci il codice della tua app authenticator, oppure uno dei
              tuoi codici di backup.
            </p>
          </div>
        ) : null}

        {state.error ? (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {state.error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={pending}
          className="rounded-full bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-hover disabled:opacity-60"
        >
          {pending ? "Salvataggio…" : "Salva nuova password"}
        </button>
      </form>
    </div>
  );
}
