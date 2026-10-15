"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSupabase } from "@/lib/db/supabase/use-supabase";
import { listPendingGuardianChecks, type PendingGuardianCheck } from "@/domain/digital-legacy/guardians";
import { firstNameOf } from "@/domain/digital-legacy/guardian-answers";
import { formatDate } from "@/lib/format";
import { BTN_PRIMARY } from "@/components/ui/styles";

/**
 * "Marta ha bisogno di te": le richieste ai guardiani ancora senza risposta, in cima a Oggi e in Protetti. Non serve la
 * master password (nessun dato cifrato: solo il nome e la data), così la vede anche chi non ha mai creato la propria.
 * Se non ce ne sono, non mostra nulla; se la lettura fallisce, nemmeno: l'email resta comunque.
 */
export function PendingGuardianChecks() {
  const supabase = useSupabase();
  const [checks, setChecks] = useState<PendingGuardianCheck[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;
        const found = await listPendingGuardianChecks(supabase, user.id);
        if (!cancelled) setChecks(found);
      } catch {
        // Un avviso in più: se non si riesce a leggerlo, resta l'email.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  if (checks.length === 0) return null;

  return (
    <section aria-label="Richieste ai guardiani" className="flex flex-col gap-3">
      {checks.map((check) => {
        const name = firstNameOf(check.ownerName);
        return (
          <div
            key={check.id}
            className="flex flex-wrap items-center gap-4 rounded-2xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/40"
          >
            <div className="min-w-0 flex-1">
              <p className="font-heading text-base font-extrabold text-zinc-900 dark:text-zinc-100">
                {check.ownerName} ha bisogno di te
              </p>
              <p className="mt-0.5 text-sm text-zinc-700 dark:text-zinc-300">
                Sei la persona di fiducia di {name}: da tempo non accede a Hinthial. Dicci se hai sue notizie. Te lo chiediamo
                dal {formatDate(check.createdAt)}.
              </p>
            </div>
            <Link href={`/guardian-check/${check.id}`} className={`shrink-0 ${BTN_PRIMARY}`}>
              Rispondi
            </Link>
          </div>
        );
      })}
    </section>
  );
}
