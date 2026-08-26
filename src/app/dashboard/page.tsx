"use client";

import { AppShell } from "@/components/layout/AppShell";
import { useMockSession } from "@/lib/auth/use-mock-session";

export default function DashboardPage() {
  const state = useMockSession();
  const displayName =
    state.status === "authenticated" ? state.session.displayName : "";

  return (
    <AppShell>
      <h1 className="text-2xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
        {displayName ? `Ciao, ${displayName}` : "Dashboard"}
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
    </AppShell>
  );
}
