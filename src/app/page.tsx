"use client";

import Link from "next/link";
import { useMockSession } from "@/lib/auth/use-mock-session";

export default function Home() {
  const state = useMockSession();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-zinc-50 px-6 text-center font-sans dark:bg-black">
      <h1 className="text-3xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
        HINTHIAL
      </h1>
      <p className="max-w-md text-base text-zinc-600 dark:text-zinc-400">
        Metti ordine nella tua vita digitale, proteggi ciò che conta e rendi
        le informazioni importanti accessibili alle persone giuste quando
        serve.
      </p>

      {state.status === "authenticated" ? (
        <Link
          href="/dashboard"
          className="rounded-md bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          Vai alla dashboard
        </Link>
      ) : (
        <div className="flex flex-col gap-3 sm:flex-row">
          <Link
            href="/register"
            className="rounded-md bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            Crea account
          </Link>
          <Link
            href="/login"
            className="rounded-md border border-zinc-300 px-5 py-2.5 text-sm font-medium text-zinc-900 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-50 dark:hover:bg-zinc-900"
          >
            Accedi
          </Link>
        </div>
      )}
    </div>
  );
}
