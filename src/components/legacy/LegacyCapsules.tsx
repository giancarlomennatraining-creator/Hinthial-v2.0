"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSupabase } from "@/lib/db/supabase/use-supabase";
import { listCapsules, setCapsuleOpenOnLegacy } from "@/domain/capsules/repository";
import { CAPSULE_STATUS_LABEL } from "@/domain/capsules/labels";
import type { CapsuleListItem } from "@/domain/capsules/types";
import { useToast } from "@/components/ui/ToastProvider";
import { formatDate } from "@/lib/format";
import { sortAlphabetically } from "@/lib/utils";

/**
 * "Cosa arriverà": le tue capsule e, per ognuna, se si apre solo alla sua data o anche prima, se l'Eredità digitale
 * consegna. È la stessa regola che si sceglie scrivendo la capsula, qui tutte insieme. Si può cambiare finché la
 * capsula non si è aperta (v. setCapsuleOpenOnLegacy). Richiede la master key: i titoli sono cifrati.
 */
export function LegacyCapsules({ masterKey }: { masterKey: CryptoKey }) {
  const supabase = useSupabase();
  const showToast = useToast();
  const [capsules, setCapsules] = useState<CapsuleListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  // Letto una volta al mount, non chiamando l'impuro Date.now() durante il render.
  const [now] = useState(() => new Date());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const loaded = await listCapsules(supabase, masterKey);
        if (!cancelled) setCapsules(loaded);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Impossibile caricare le capsule.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase, masterKey]);

  async function toggle(capsule: CapsuleListItem) {
    const next = !capsule.openOnLegacy;
    setBusyId(capsule.id);
    setError(null);
    try {
      await setCapsuleOpenOnLegacy(supabase, capsule.id, next);
      setCapsules((prev) => (prev ?? []).map((c) => (c.id === capsule.id ? { ...c, openOnLegacy: next } : c)));
      showToast(next ? "Si aprirà anche prima, se non ci sei più." : "Si aprirà solo alla data scelta.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossibile cambiare la regola della capsula.");
    } finally {
      setBusyId(null);
    }
  }

  const early = (capsules ?? []).filter((c) => c.openOnLegacy && c.status !== "draft").length;

  return (
    <section aria-labelledby="legacy-capsules-title" className="flex flex-col gap-4">
      <div>
        <h2 id="legacy-capsules-title" className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          Cosa arriverà
        </h2>
        <p className="mt-1 max-w-2xl text-sm text-zinc-500 dark:text-zinc-400">
          Alla consegna si aprono solo le capsule che hai destinato a questo momento. Tutte le altre aspettano la loro data.
        </p>
      </div>

      {error ? (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : null}

      {capsules === null ? (
        error ? null : <p className="text-sm text-zinc-500 dark:text-zinc-400">Caricamento…</p>
      ) : capsules.length === 0 ? (
        <div className="flex max-w-2xl flex-col items-start gap-2 rounded-xl border border-dashed border-zinc-300 p-4 dark:border-zinc-700">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Non hai ancora scritto nessuna capsula. Una capsula è una lettera, un ricordo o un messaggio per qualcuno.
          </p>
          <Link href="/capsules/new" className="text-sm font-semibold text-accent hover:underline">
            Scrivi una capsula →
          </Link>
        </div>
      ) : (
        <>
          <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            {early === 0
              ? "Nessuna capsula si aprirà prima della sua data."
              : early === 1
                ? "1 capsula si aprirà anche prima, alla consegna."
                : `${early} capsule si apriranno anche prima, alla consegna.`}
          </p>
          <ul className="flex flex-col divide-y divide-zinc-200 surface-card rounded-card border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-950">
            {sortAlphabetically(capsules, (c) => c.title).map((capsule) => {
              const opened = capsule.openAt !== null && new Date(capsule.openAt) <= now;
              const recipients = sortAlphabetically(capsule.relatedFriends, (f) => f.name)
                .map((f) => f.name)
                .join(", ");
              return (
                <li key={capsule.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">{capsule.title}</span>
                    <span className="text-xs text-zinc-500 dark:text-zinc-400">
                      {recipients ? `Per ${recipients} · ` : "Senza destinatari · "}
                      {CAPSULE_STATUS_LABEL[capsule.status]}
                      {capsule.openAt ? ` · si apre il ${formatDate(capsule.openAt)}` : ""}
                    </span>
                  </span>
                  {opened ? (
                    <span className="text-xs text-zinc-500 dark:text-zinc-400">Già aperta</span>
                  ) : (
                    <label className="flex shrink-0 cursor-pointer items-center gap-2 text-xs font-medium text-zinc-700 dark:text-zinc-300">
                      <input
                        type="checkbox"
                        checked={capsule.openOnLegacy}
                        disabled={busyId === capsule.id}
                        onChange={() => toggle(capsule)}
                        aria-label={`Apri anche prima, se non ci sono più: ${capsule.title}`}
                        className="h-4 w-4 rounded border-zinc-300 text-accent focus:ring-brand dark:border-zinc-700"
                      />
                      Anche prima, se non ci sono più
                    </label>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}
