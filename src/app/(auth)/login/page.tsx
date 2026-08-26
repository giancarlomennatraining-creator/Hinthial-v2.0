"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { createMockSession } from "@/lib/auth/mock-session";
import { TextField } from "@/components/ui/TextField";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!email || !password) {
      setError("Inserisci email e password.");
      return;
    }

    // FASE 1: nessuna verifica reale delle credenziali --- la vera
    // autenticazione (Supabase Auth) arriva in FASE 2.
    createMockSession({ email, displayName: email.split("@")[0] });
    router.push("/dashboard");
  }

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

      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        <TextField
          id="email"
          label="Email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <TextField
          id="password"
          label="Password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        {error ? (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          Accedi
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
