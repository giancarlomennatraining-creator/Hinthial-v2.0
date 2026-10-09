"use client";

import { DangerConfirmCard } from "@/components/settings/DangerConfirmCard";
import { CheckCircleIcon } from "@/components/icons/nav-icons";
import { wipeVault } from "@/domain/danger-zone/repository";
import { useSupabase } from "@/lib/db/supabase/use-supabase";
import { sendAccountResetConfirmationEmail } from "@/lib/account/actions";

/**
 * "Reimposta l'account", irreversibile (v. domain/danger-zone/repository.ts per cosa viene eliminato). A differenza
 * di DeleteAccountCard, l'account resta attivo: solo il suo contenuto viene svuotato. La Master Key già sbloccata
 * serve a scoprire i path in Storage per `wipeVault`.
 */
export function ResetAccountCard({ userId, masterKey }: { userId: string; masterKey: CryptoKey }) {
  const supabase = useSupabase();

  return (
    <DangerConfirmCard
      title="Reimposta l'account"
      description={
        <>
          Svuota completamente il tuo vault (Archivio, Beni, Amici e Capsule) e ripristina le categorie predefinite,
          mantenendo l&apos;account attivo — utile per ricominciare da capo senza cancellarti. Le Scadenze non vengono
          eliminate — restano, solo scollegate da ciò che viene cancellato. Richiede la tua master password.
          L&apos;operazione non è reversibile, e riceverai un&apos;email di conferma.
        </>
      }
      triggerLabel="Reimposta account"
      dialogLabel="Conferma reimpostazione account"
      dialogText="Archivio, Beni, Amici e Capsule verranno eliminati per sempre. Non si può annullare."
      confirmPhrase="REIMPOSTA TUTTO"
      idPrefix="reset"
      confirmLabel="Reimposta definitivamente"
      busyLabel="Reimpostazione…"
      fallbackError="Impossibile completare l'operazione."
      doneMessage={
        <p className="flex items-start gap-1.5 text-sm font-medium text-red-700 dark:text-red-400">
          <CheckCircleIcon width={16} height={16} className="mt-0.5 shrink-0" />
          Il vault è stato svuotato. Le categorie predefinite sono di nuovo disponibili.
        </p>
      }
      run={async (markDone) => {
        await wipeVault(supabase, masterKey, userId);
        markDone();

        // Best-effort: l'operazione è già avvenuta, un'email non riuscita non deve farla sembrare fallita.
        await sendAccountResetConfirmationEmail().catch(() => {});
      }}
    />
  );
}
