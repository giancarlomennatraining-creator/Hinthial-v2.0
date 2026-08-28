import { getCurrentUser } from "@/lib/auth/current-user";

export default async function DashboardPage() {
  const user = await getCurrentUser();

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
        {user ? `Ciao, ${user.displayName}` : "Dashboard"}
      </h1>
      <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
        Questa è la tua dashboard. Scadenze, documenti recenti e attività da
        completare compariranno qui man mano che aggiungerai contenuti.
      </p>

      <div className="mt-6 rounded-lg border border-dashed border-zinc-300 p-8 text-center dark:border-zinc-700">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Nessun contenuto ancora. Inizia dal Vault per aggiungere il tuo
          primo documento.
        </p>
      </div>
    </>
  );
}
