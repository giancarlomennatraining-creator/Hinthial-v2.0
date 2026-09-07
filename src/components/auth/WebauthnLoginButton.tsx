"use client";

import { useRef, useState } from "react";
import { createClient } from "@/lib/db/supabase/client";
import { authenticateWithWebauthnFactor } from "@/domain/mfa/repository";
import { logAuditEvent } from "@/lib/audit/log-event";
import type { MfaFactor } from "@/domain/mfa/types";

/**
 * Login con una passkey già registrata (v. domain/mfa/repository.ts) ---
 * a differenza del codice TOTP/di backup, richiede `navigator.credentials`,
 * quindi non può passare da una server action: la cerimonia del browser
 * gira qui, poi si registra l'accesso e si passa alla dashboard con una
 * navigazione vera (non un push lato client), perché la sessione
 * aggiornata (aal2) viaggia nei cookie e il layout server-side la legge
 * alla richiesta successiva --- una navigazione soft potrebbe precederla.
 */
export function WebauthnLoginButton({ factor }: { factor: MfaFactor }) {
  const supabase = useRef(createClient()).current;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setError(null);
    setBusy(true);
    try {
      await authenticateWithWebauthnFactor(supabase, factor.id);
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        await logAuditEvent(supabase, user.id, "login");
      }
      // Navigazione vera, non un push lato client (v. doc comment sopra
      // sul perché) --- serve che il layout server-side veda i cookie
      // già aggiornati alla sessione aal2.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.href = "/dashboard";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossibile verificare la passkey.");
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        disabled={busy}
        onClick={handleClick}
        className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
      >
        {busy ? "Verifica…" : `🔑 Usa: ${factor.friendlyName}`}
      </button>
      {error ? (
        <p role="alert" className="text-xs text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : null}
    </div>
  );
}
