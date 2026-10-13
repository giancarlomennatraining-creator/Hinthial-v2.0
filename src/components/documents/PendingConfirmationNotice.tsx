"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSupabase } from "@/lib/db/supabase/use-supabase";
import { loadPendingConfirmation, removePendingConfirmation } from "@/domain/documents/pending-confirmation";

/**
 * "3 documenti da confermare": i documenti importati insieme di cui non si è finita la conferma (v. ConfirmImport), per
 * riaprirla da Archivio se la si è chiusa a metà. Il promemoria sta su questo dispositivo; i documenti che nel frattempo
 * non ci sono più non contano. Non compare se non c'è nulla da confermare.
 */
export function PendingConfirmationNotice({ existingIds }: { existingIds: string[] }) {
  const supabase = useSupabase();
  const [userId, setUserId] = useState<string | null>(null);
  const [pending, setPending] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (cancelled || !user) return;
      setUserId(user.id);
      setPending(loadPendingConfirmation(user.id));
    });
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  const existing = new Set(existingIds);
  const ids = pending.filter((id) => existing.has(id));
  if (ids.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-brand/30 bg-brand/5 p-4">
      <p className="min-w-0 text-sm text-zinc-700 dark:text-zinc-300">
        {ids.length === 1 ? "Hai 1 documento importato da confermare." : `Hai ${ids.length} documenti importati da confermare.`}
      </p>
      <div className="flex items-center gap-4">
        <Link href={`/archive/confirm?ids=${ids.join(",")}`} className="text-sm font-semibold text-brand underline-offset-2 hover:underline">
          Rivedi
        </Link>
        <button
          type="button"
          onClick={() => {
            if (userId) removePendingConfirmation(userId, ids);
            setPending((prev) => prev.filter((id) => !ids.includes(id)));
          }}
          className="text-sm font-medium text-zinc-500 underline-offset-2 hover:underline dark:text-zinc-400"
        >
          Non ora
        </button>
      </div>
    </div>
  );
}
