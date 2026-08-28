"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { signUp } from "@/lib/auth/actions";
import { initialAuthActionState } from "@/lib/auth/action-state";
import { TextField } from "@/components/ui/TextField";
import { PasswordStrengthMeter } from "@/components/ui/PasswordStrengthMeter";

export default function RegisterPage() {
  const [state, formAction, pending] = useActionState(
    signUp,
    initialAuthActionState,
  );
  const [password, setPassword] = useState("");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
          Crea account
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Inizia a mettere ordine nella tua vita digitale.
        </p>
      </div>

      <form action={formAction} className="flex flex-col gap-4">
        <TextField
          id="displayName"
          name="displayName"
          label="Nome"
          type="text"
          autoComplete="name"
          required
        />
        <TextField
          id="email"
          name="email"
          label="Email"
          type="email"
          autoComplete="email"
          required
        />
        <div className="flex flex-col gap-2">
          <TextField
            id="password"
            name="password"
            label="Password"
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
          label="Conferma password"
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
          {pending ? "Creazione account…" : "Crea account"}
        </button>
      </form>

      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        Hai già un account?{" "}
        <Link
          href="/login"
          className="font-medium text-zinc-900 underline-offset-2 hover:underline dark:text-zinc-100"
        >
          Accedi
        </Link>
      </p>
    </div>
  );
}
