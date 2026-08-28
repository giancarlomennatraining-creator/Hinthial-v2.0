"use client";

import Link from "next/link";
import { useMasterKey } from "@/components/crypto/MasterKeyProvider";
import { DashboardWidgets } from "@/components/dashboard/DashboardWidgets";

/**
 * The greeting always renders, regardless of encryption status ---
 * only the widgets (which need to decrypt reminder/document data) are
 * gated, with a lightweight inline prompt rather than a full-page
 * takeover. A brand-new user (no encryption set up yet) or a returning
 * one after a refresh (locked) should still see "Ciao, ..." immediately.
 */
export function DashboardPanel({ displayName }: { displayName: string }) {
  const { status } = useMasterKey();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
          Ciao, {displayName}
        </h1>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          Questa è la tua dashboard: scadenze, documenti recenti e attività da
          completare.
        </p>
      </div>

      {status.kind === "unlocked" ? (
        <DashboardWidgets masterKey={status.masterKey} />
      ) : status.kind === "checking" ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Caricamento…</p>
      ) : (
        <div className="rounded-lg border border-dashed border-zinc-300 p-8 text-center dark:border-zinc-700">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {status.kind === "not-set-up"
              ? "Configura la cifratura per iniziare a vedere scadenze e documenti qui."
              : "Sblocca la cifratura per vedere le tue scadenze e i tuoi documenti recenti."}
          </p>
          <Link
            href="/documenti"
            className="mt-2 inline-block text-sm font-medium text-brand hover:underline"
          >
            Vai a Documenti
          </Link>
        </div>
      )}
    </div>
  );
}
