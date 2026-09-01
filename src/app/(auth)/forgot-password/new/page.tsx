"use client";

import { useActionState, useState } from "react";
import { resetPassword } from "@/lib/auth/actions";
import { initialAuthActionState } from "@/lib/auth/action-state";
import { TextField } from "@/components/ui/TextField";
import { PasswordStrengthMeter } from "@/components/ui/PasswordStrengthMeter";

export default function NewPasswordPage() {
  const [state, formAction, pending] = useActionState(
    resetPassword,
    initialAuthActionState,
  );
  const [password, setPassword] = useState("");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
          Imposta una nuova password
        </h1>
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
          {pending ? "Salvataggio…" : "Salva nuova password"}
        </button>
      </form>
    </div>
  );
}
