"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { createClient } from "@/lib/db/supabase/client";
import { useMasterKey } from "@/components/crypto/MasterKeyProvider";
import { PasswordComparisonNote } from "@/components/crypto/PasswordComparisonNote";
import { markMasterKeyIntroSeen } from "@/domain/profile/repository";

/**
 * Popup mostrato una sola volta, subito dopo il login, a chi non ha
 * ancora configurato la cifratura --- invita a farlo subito invece di
 * scoprirlo solo cliccando in giro (v. anche il pallino "richiede setup"
 * sulla navigazione e il checklist in Dashboard, entrambi persistenti:
 * questo popup è solo un'introduzione una tantum, non li sostituisce).
 *
 * "Una tantum" --- qualunque modo di chiuderlo (✕, "Più tardi", sfondo,
 * o il tasto che porta alla creazione) lo segna come visto per sempre
 * (profiles.master_key_intro_seen, sincronizzato sul server come
 * onboarding_widget_hidden): niente casella "non mostrare più" a parte,
 * sarebbe ridondante dato che non si ripresenta comunque. Chi ha già
 * configurato la cifratura (status "locked"/"unlocked") non lo vede mai,
 * a prescindere dal flag --- diventato irrilevante a quel punto.
 */
export function MasterKeyIntroModal({
  userId,
  initialSeen,
}: {
  userId: string;
  initialSeen: boolean;
}) {
  const { status } = useMasterKey();
  const router = useRouter();
  const [seen, setSeen] = useState(initialSeen);

  function dismiss() {
    setSeen(true);
    const supabase = createClient();
    markMasterKeyIntroSeen(supabase, userId).catch(() => {
      // Nessun blocco dell'interfaccia: se il salvataggio fallisce,
      // ricomparirà al prossimo login --- non grave per un'introduzione.
    });
  }

  function handleCreate() {
    dismiss();
    router.push("/archive");
  }

  if (seen || status.kind !== "not-set-up") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={dismiss}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Crea la tua master key"
        onClick={(e) => e.stopPropagation()}
        className="flex w-full max-w-md flex-col gap-4 rounded-lg border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-800 dark:bg-zinc-950"
      >
        <div className="flex items-start justify-between gap-4">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            Proteggi i tuoi dati con una master password
          </h2>
          <button
            type="button"
            onClick={dismiss}
            aria-label="Chiudi"
            className="shrink-0 rounded-md p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-900 dark:hover:text-zinc-300"
          >
            ✕
          </button>
        </div>

        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Prima di iniziare, crea la master key che cifra tutto ciò che salvi su Hinthial --- un
          passo separato dalla password del tuo account, che richiede solo un minuto.
        </p>

        <PasswordComparisonNote />

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={handleCreate}
            className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-hover"
          >
            Crea la tua master key
          </button>
          <button
            type="button"
            onClick={dismiss}
            className="rounded-md px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900"
          >
            Più tardi
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
