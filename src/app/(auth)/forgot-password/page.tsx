"use client";

import Link from "next/link";
import { useActionState } from "react";
import { requestPasswordReset } from "@/lib/auth/actions";
import { initialAuthActionState } from "@/lib/auth/action-state";
import { TextField } from "@/components/ui/TextField";

export default function ForgotPasswordPage() {
  const [state, formAction, pending] = useActionState(
    requestPasswordReset,
    initialAuthActionState,
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
          Password dimenticata
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Inserisci la tua email: ti invieremo un codice per reimpostare la password.
        </p>
      </div>

      <form action={formAction} className="flex flex-col gap-4">
        <TextField
          id="email"
          name="email"
          label="Email"
          type="email"
          autoComplete="email"
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
          {pending ? "Invio…" : "Invia codice"}
        </button>
      </form>

      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        <Link
          href="/login"
          className="font-medium text-zinc-900 underline-offset-2 hover:underline dark:text-zinc-100"
        >
          Torna al login
        </Link>
      </p>
    </div>
  );
}
