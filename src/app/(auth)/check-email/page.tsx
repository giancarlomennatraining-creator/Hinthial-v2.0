import Link from "next/link";

export default async function CheckEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const { email } = await searchParams;

  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <h1 className="text-xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
        Controlla la tua email
      </h1>
      <p className="max-w-sm text-sm text-zinc-500 dark:text-zinc-400">
        {email ? (
          <>
            Abbiamo inviato un&apos;email di conferma a{" "}
            <strong className="font-medium text-zinc-700 dark:text-zinc-300">{email}</strong>.
          </>
        ) : (
          "Abbiamo inviato un'email di conferma al tuo indirizzo."
        )}{" "}
        Apri il link al suo interno per verificare l&apos;account e poter accedere.
      </p>
      <p className="text-xs text-zinc-400 dark:text-zinc-600">
        Non la trovi? Controlla anche nello spam.
      </p>
      <Link
        href="/login"
        className="mt-2 text-sm font-medium text-zinc-600 underline-offset-2 hover:underline dark:text-zinc-400"
      >
        Torna al login
      </Link>
    </div>
  );
}
