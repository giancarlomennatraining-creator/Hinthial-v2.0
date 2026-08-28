import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/current-user";

export default async function Home() {
  const user = await getCurrentUser();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-zinc-50 px-6 text-center font-sans dark:bg-black">
      <h1>
        {/* eslint-disable-next-line @next/next/no-img-element -- brand asset (SVG), not user content */}
        <img src="/brand/logo-lockup.svg" alt="HINTHIAL" className="h-16 w-auto" />
      </h1>
      <p className="max-w-md text-base text-zinc-600 dark:text-zinc-400">
        Metti ordine nella tua vita digitale, proteggi ciò che conta e rendi
        le informazioni importanti accessibili alle persone giuste quando
        serve.
      </p>

      {user ? (
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
