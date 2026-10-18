"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSupabase } from "@/lib/db/supabase/use-supabase";
import { listFriends } from "@/domain/friends/repository";
import type { FriendListItem } from "@/domain/friends/types";
import { sortAlphabetically } from "@/lib/utils";
import { SettingsBlock } from "@/components/settings/SettingsBlock";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

/**
 * "Chi conferma la tua assenza": i guardiani, cioè gli amici che hai scelto perché possano dire se riescono a raggiungerti.
 * Qui si vedono e si controlla chi manca (un guardiano senza account Hinthial non può essere interpellato); si scelgono
 * e si accettano da Amici, dove c'è già la richiesta di consenso. Richiede la master key: i nomi sono cifrati.
 */
export function LegacyGuardians({ masterKey }: { masterKey: CryptoKey }) {
  const supabase = useSupabase();
  const [guardians, setGuardians] = useState<FriendListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const friends = await listFriends(supabase, masterKey);
        if (!cancelled) setGuardians(friends.filter((f) => f.isGuardian && f.status === "active"));
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Impossibile caricare i guardiani.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase, masterKey]);

  const unreachable = (guardians ?? []).filter((g) => !g.linkedUserId);

  return (
    <SettingsBlock
      id="guardians"
      title="Chi conferma la tua assenza"
      description="I tuoi guardiani sono le persone a cui chiedo se riescono a raggiungerti, prima di consegnare le capsule. Non ereditano nulla: dicono solo se stai bene."
    >

      {error ? (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : guardians === null ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Caricamento…</p>
      ) : guardians.length === 0 ? (
        <div className="flex max-w-2xl flex-col items-start gap-2 rounded-xl border border-dashed border-zinc-300 p-4 dark:border-zinc-700">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Non hai ancora nessun guardiano. Senza, la consegna non può partire: scegline almeno uno tra i tuoi amici.
          </p>
          <Link href="/friends" className="text-sm font-semibold text-accent hover:underline">
            Scegli i guardiani in Amici →
          </Link>
        </div>
      ) : (
        <>
          <ul className="grid gap-2 sm:grid-cols-2">
            {sortAlphabetically(guardians, (g) => g.name).map((guardian) => (
              <li
                key={guardian.id}
                className="flex items-center gap-2.5 rounded-xl border border-zinc-200 px-3 py-2 dark:border-zinc-800"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand text-xs font-bold text-white">
                  {initials(guardian.name)}
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">{guardian.name}</span>
                  <span className="truncate text-xs text-zinc-500 dark:text-zinc-400">{guardian.role || "Guardiano"}</span>
                </span>
                {guardian.linkedUserId ? (
                  <span className="shrink-0 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-950 dark:text-green-400">
                    Raggiungibile
                  </span>
                ) : (
                  <span className="shrink-0 rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-700 dark:bg-orange-950 dark:text-orange-400">
                    Senza account
                  </span>
                )}
              </li>
            ))}
          </ul>
          {unreachable.length > 0 ? (
            <p className="max-w-2xl text-xs text-orange-700 dark:text-orange-400">
              {unreachable.length === 1
                ? `${unreachable[0].name} non ha un account Hinthial: non potrà essere interpellato.`
                : `${unreachable.map((g) => g.name).join(", ")} non hanno un account Hinthial: non potranno essere interpellati.`}{" "}
              Invitali da Amici.
            </p>
          ) : null}
          <Link href="/friends" className="w-fit text-sm font-medium text-accent hover:underline">
            Aggiungi o togli guardiani in Amici →
          </Link>
        </>
      )}
    </SettingsBlock>
  );
}
