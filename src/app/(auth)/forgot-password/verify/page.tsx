"use client";

import Link from "next/link";
import { Suspense, useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { verifyPasswordResetOtp } from "@/lib/auth/actions";
import { initialAuthActionState } from "@/lib/auth/action-state";
import { TextField } from "@/components/ui/TextField";

function VerifyCodeForm() {
  const searchParams = useSearchParams();
  const email = searchParams.get("email") ?? "";

  const [state, formAction, pending] = useActionState(
    verifyPasswordResetOtp,
    initialAuthActionState,
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
          Controlla la tua email
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          {email ? (
            <>
              Abbiamo inviato un codice a{" "}
              <strong className="font-medium text-zinc-700 dark:text-zinc-300">{email}</strong>.
            </>
          ) : (
            "Abbiamo inviato un codice al tuo indirizzo."
          )}{" "}
          Inseriscilo qui sotto.
        </p>
      </div>

      <form action={formAction} className="flex flex-col gap-4">
        <input type="hidden" name="email" value={email} />
        <TextField
          id="otp"
          name="otp"
          label="Codice di verifica"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          placeholder="123456"
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
          {pending ? "Verifica…" : "Verifica codice"}
        </button>
      </form>

      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        Non hai ricevuto nulla?{" "}
        <Link
          href="/forgot-password"
          className="font-medium text-zinc-900 underline-offset-2 hover:underline dark:text-zinc-100"
        >
          Riprova
        </Link>
      </p>
    </div>
  );
}

export default function VerifyCodePage() {
  return (
    <Suspense>
      <VerifyCodeForm />
    </Suspense>
  );
}
