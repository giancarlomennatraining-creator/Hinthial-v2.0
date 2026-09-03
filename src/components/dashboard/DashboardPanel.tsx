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
        {status.kind !== "checking" ? (
          <span
            className={
              status.kind === "not-set-up"
                ? "mt-3 inline-block rounded-full bg-orange-100 px-2.5 py-1 text-xs font-medium text-orange-700 dark:bg-orange-950 dark:text-orange-400"
                : "mt-3 inline-block rounded-full bg-green-100 px-2.5 py-1 text-xs font-medium text-green-700 dark:bg-green-950 dark:text-green-400"
            }
          >
            {status.kind === "not-set-up"
              ? "⚠️ Master password non ancora creata"
              : "✅ Master password creata · recovery key salvata"}
          </span>
        ) : null}
      </div>

      {status.kind === "unlocked" ? (
        <DashboardWidgets masterKey={status.masterKey} />
      ) : status.kind === "checking" ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Caricamento…</p>
      ) : (
        <div className="rounded-lg border border-dashed border-zinc-300 p-8 text-center dark:border-zinc-700">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {status.kind === "not-set-up"
              ? "Configura la cifratura per iniziare a vedere scadenze e archivio qui."
              : "Sblocca la cifratura per vedere le tue scadenze e il tuo archivio recente."}
          </p>
          <Link
            href="/archive"
            className="mt-2 inline-block text-sm font-medium text-brand hover:underline"
          >
            Vai all&apos;archivio
          </Link>
        </div>
      )}
    </div>
  );
}
