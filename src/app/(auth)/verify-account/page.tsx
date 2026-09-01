import Link from "next/link";

export default async function VerifyAccountPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  if (error) {
    return (
      <div className="flex flex-col items-center gap-4 text-center">
        <h1 className="text-xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
          Verifica non riuscita
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Il link di verifica non è valido o è scaduto. Prova a registrarti
          di nuovo.
        </p>
        <Link
          href="/register"
          className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-hover"
        >
          Torna alla registrazione
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <h1 className="text-xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
        Account verificato
      </h1>
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        La tua email è stata confermata. Ora puoi accedere al tuo account.
      </p>
      <Link
        href="/login"
        className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-hover"
      >
        Vai al login
      </Link>
    </div>
  );
}
