import Link from "next/link";
import { AlertTriangleIcon, CheckCircleIcon } from "@/components/icons/nav-icons";

export default async function VerifyAccountPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  if (error) {
    return (
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10">
          <AlertTriangleIcon width={24} height={24} className="text-red-600 dark:text-red-400" />
        </div>
        <h1 className="text-xl font-semibold tracking-tight text-brand">
          Verifica non riuscita
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Il link di verifica non è valido o è scaduto. Prova a registrarti
          di nuovo.
        </p>
        <Link
          href="/register"
          className="rounded-full bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-hover"
        >
          Torna alla registrazione
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10">
        <CheckCircleIcon width={24} height={24} className="text-emerald-600 dark:text-emerald-400" />
      </div>
      <h1 className="text-xl font-semibold tracking-tight text-brand">
        Account verificato
      </h1>
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        La tua email è stata confermata. Ora puoi accedere al tuo account.
      </p>
      <Link
        href="/login"
        className="rounded-full bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-hover"
      >
        Vai al login
      </Link>
    </div>
  );
}
