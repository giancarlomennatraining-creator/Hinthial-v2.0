"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signIn } from "@/lib/auth/actions";
import { initialAuthActionState } from "@/lib/auth/action-state";
import { TextField } from "@/components/ui/TextField";

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(
    signIn,
    initialAuthActionState,
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
          Accedi
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Bentornato su HINTHIAL.
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
        <TextField
          id="password"
          name="password"
          label="Password"
          type="password"
          autoComplete="current-password"
          required
        />

        <Link
          href="/forgot-password"
          className="-mt-2 self-end text-xs font-medium text-zinc-500 underline-offset-2 hover:underline dark:text-zinc-400"
        >
          Password dimenticata?
        </Link>

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
          {pending ? "Accesso in corso…" : "Accedi"}
        </button>
      </form>

      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        Non hai un account?{" "}
        <Link
          href="/register"
          className="font-medium text-zinc-900 underline-offset-2 hover:underline dark:text-zinc-100"
        >
          Crea account
        </Link>
      </p>
    </div>
  );
}
